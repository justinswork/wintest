"""Qwen2.5-VL vision model — general-purpose VLM with grounding capabilities."""

import json
import logging
import os
import re
import tempfile

import torch
from PIL import Image
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor, BitsAndBytesConfig

from .base import BaseVisionModel

logger = logging.getLogger(__name__)


class Qwen25VLModel(BaseVisionModel):
    """Qwen2.5-VL: general-purpose vision-language model with bounding box grounding."""

    MIN_PIXELS = 256 * 28 * 28
    MAX_PIXELS = 1344 * 28 * 28

    def __init__(self, model_settings):
        self.settings = model_settings
        self.model_path = model_settings.model_path
        self.model = None
        self.processor = None
        self._loaded = False

    def load(self):
        if self._loaded:
            return

        logger.info("Loading %s (this may take a minute)...", self.model_path)

        load_kwargs = {
            "torch_dtype": torch.bfloat16,
            "device_map": "auto",
        }

        if self.settings.load_in_4bit:
            load_kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_quant_type=self.settings.bnb_4bit_quant_type,
                bnb_4bit_use_double_quant=self.settings.bnb_4bit_use_double_quant,
            )

        self.model = Qwen2VLForConditionalGeneration.from_pretrained(
            self.model_path, **load_kwargs
        ).eval()

        self.processor = AutoProcessor.from_pretrained(
            self.model_path,
            min_pixels=self.MIN_PIXELS,
            max_pixels=self.MAX_PIXELS,
        )

        self._loaded = True
        logger.info("Model loaded successfully.")

    def find_element(self, screenshot: Image.Image, element_name: str) -> dict:
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        from qwen_vl_utils import process_vision_info

        img_width, img_height = screenshot.size
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                screenshot.save(f, format="PNG")
                tmp_path = f.name

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "image": tmp_path,
                            "min_pixels": self.MIN_PIXELS,
                            "max_pixels": self.MAX_PIXELS,
                        },
                        {
                            "type": "text",
                            "text": (
                                f"Locate the '{element_name}' in this screenshot and "
                                f"return its position as a JSON object in the format: "
                                f'{{"bbox_2d": [x1, y1, x2, y2]}}'
                            ),
                        },
                    ],
                }
            ]

            text = self.processor.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            image_inputs, video_inputs = process_vision_info(messages)
            inputs = self.processor(
                text=[text],
                images=image_inputs,
                videos=video_inputs,
                padding=True,
                return_tensors="pt",
            ).to("cuda")

            with torch.no_grad():
                generated_ids = self.model.generate(
                    **inputs, max_new_tokens=self.settings.max_new_tokens
                )

            generated_ids_trimmed = [
                out_ids[len(in_ids):]
                for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
            ]
            response = self.processor.batch_decode(
                generated_ids_trimmed,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False,
            )[0]

            coordinates = self.parse_coordinates(response, img_width, img_height)
            return {"raw_response": response, "coordinates": coordinates}

        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    @staticmethod
    def parse_coordinates(response_text: str, img_width: int = 1000,
                          img_height: int = 1000) -> tuple[int, int] | None:
        """
        Parse Qwen2.5-VL bounding box output and convert to 0-1000 scale center point.

        Qwen2.5-VL returns pixel coordinates relative to the processed image.
        We normalize them to 0-1000 scale using the original image dimensions.
        """
        text = response_text.strip()

        # Try JSON format: {"bbox_2d": [x1, y1, x2, y2]}
        try:
            data = json.loads(text)
            if "bbox_2d" in data:
                x1, y1, x2, y2 = data["bbox_2d"]
                cx = (x1 + x2) / 2 / img_width
                cy = (y1 + y2) / 2 / img_height
                if 0 <= cx <= 1 and 0 <= cy <= 1:
                    return BaseVisionModel.coords_01_to_1000(cx, cy)
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        # Regex fallback: bbox_2d": [x1, y1, x2, y2] embedded in text
        bbox_match = re.search(
            r'"?bbox_2d"?\s*:\s*\[(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\]',
            text,
        )
        if bbox_match:
            x1, y1 = int(bbox_match.group(1)), int(bbox_match.group(2))
            x2, y2 = int(bbox_match.group(3)), int(bbox_match.group(4))
            cx = (x1 + x2) / 2 / img_width
            cy = (y1 + y2) / 2 / img_height
            if 0 <= cx <= 1 and 0 <= cy <= 1:
                return BaseVisionModel.coords_01_to_1000(cx, cy)

        # Fallback: any four-number bracket pattern [[x1,y1,x2,y2]] or [x1,y1,x2,y2]
        four_match = re.search(
            r"\[?\[(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\]\]?", text
        )
        if four_match:
            x1, y1 = int(four_match.group(1)), int(four_match.group(2))
            x2, y2 = int(four_match.group(3)), int(four_match.group(4))
            cx = (x1 + x2) / 2 / img_width
            cy = (y1 + y2) / 2 / img_height
            if 0 <= cx <= 1 and 0 <= cy <= 1:
                return BaseVisionModel.coords_01_to_1000(cx, cy)

        return None
