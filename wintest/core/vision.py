import logging
import re
import torch
from PIL import Image
from transformers import AutoModel, AutoTokenizer, BitsAndBytesConfig, GenerationMixin, GenerationConfig
import torchvision.transforms as T
from torchvision.transforms.functional import InterpolationMode

logger = logging.getLogger(__name__)


class VisionModel:
    """Manages InternVL2-8B loading, inference, and coordinate extraction."""

    def __init__(self, model_settings=None):
        if model_settings is None:
            from ..config.settings import ModelSettings
            model_settings = ModelSettings()
        self.settings = model_settings
        self.model_path = model_settings.model_path
        self.model = None
        self.tokenizer = None
        self._loaded = False

    def load(self):
        """Load the model with 4-bit quantization and apply compatibility patches."""
        if self._loaded:
            return

        logger.info("Loading AI Brain (this may take a minute)...")

        quant_config = BitsAndBytesConfig(
            load_in_4bit=self.settings.load_in_4bit,
            bnb_4bit_compute_dtype=getattr(torch, self.settings.bnb_4bit_compute_dtype),
            bnb_4bit_quant_type=self.settings.bnb_4bit_quant_type,
            bnb_4bit_use_double_quant=self.settings.bnb_4bit_use_double_quant,
        )

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_path, trust_remote_code=True
        )
        self.model = AutoModel.from_pretrained(
            self.model_path,
            quantization_config=quant_config,
            device_map="auto",
            trust_remote_code=True,
        ).eval()

        self._apply_patches()
        self._loaded = True
        logger.info("Model loaded successfully.")

    def _apply_patches(self):
        """Apply transformers >=4.50 compatibility patches for InternLM2."""
        # Patch 1: Re-inject GenerationMixin (removed from PreTrainedModel in v4.50)
        lm_cls = type(self.model.language_model)
        if GenerationMixin not in lm_cls.__mro__:
            lm_cls.__bases__ = (GenerationMixin,) + lm_cls.__bases__

        # Patch 2: Provide a default GenerationConfig
        if self.model.language_model.generation_config is None:
            self.model.language_model.generation_config = GenerationConfig()

        # Patch 3: Handle DynamicCache → legacy tuple conversion
        orig_prepare = lm_cls.prepare_inputs_for_generation

        def patched_prepare(
            self_inner, input_ids, past_key_values=None,
            attention_mask=None, inputs_embeds=None, **kwargs
        ):
            if past_key_values is not None and not isinstance(past_key_values, tuple):
                if hasattr(past_key_values, "get_seq_length"):
                    if past_key_values.get_seq_length() == 0:
                        past_key_values = None
                    else:
                        past_key_values = past_key_values.to_legacy_cache()
            return orig_prepare(
                self_inner, input_ids,
                past_key_values=past_key_values,
                attention_mask=attention_mask,
                inputs_embeds=inputs_embeds,
                **kwargs,
            )

        lm_cls.prepare_inputs_for_generation = patched_prepare

    def find_element(self, screenshot: Image.Image, element_name: str) -> dict:
        """
        Ask the model for the location of a UI element in a screenshot.

        Returns:
            dict with keys:
                "raw_response": str — the full model response text
                "coordinates": (x, y) | None — normalized 0-1000 coordinates, or None if unparseable
        """
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        pixel_values = self._preprocess(screenshot, self.settings.input_size)

        question = (
            f"<image>\n"
            f"Find the '{element_name}' in this screenshot. "
            f"Respond with ONLY the center coordinates as [x, y] on a 0-1000 scale. "
            f"Do not explain, just output the coordinates."
        )

        with torch.no_grad():
            response = self.model.chat(
                self.tokenizer,
                pixel_values,
                question,
                generation_config=dict(max_new_tokens=self.settings.max_new_tokens),
                history=None,
            )

        coordinates = self.parse_coordinates(response)
        return {"raw_response": response, "coordinates": coordinates}

    @staticmethod
    def _preprocess(image: Image.Image, input_size: int = 448) -> torch.Tensor:
        """Preprocess a PIL image for the vision model."""
        transform = T.Compose([
            T.Resize((input_size, input_size), interpolation=InterpolationMode.BICUBIC),
            T.ToTensor(),
            T.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ])
        return transform(image).unsqueeze(0).to(torch.float16).to("cuda")

    @staticmethod
    def parse_coordinates(response_text: str) -> tuple[int, int] | None:
        """
        Extract [x, y] coordinates from model response text.

        Handles common formats:
            [500, 300]
            (500, 300)
            500, 300

        Returns (x, y) on 0-1000 scale, or None if no valid coordinates found.
        """
        patterns = [
            r"\[(\d+)\s*,\s*(\d+)\]",   # [500, 300]
            r"\((\d+)\s*,\s*(\d+)\)",    # (500, 300)
            r"(\d+)\s*,\s*(\d+)",        # 500, 300 (fallback)
        ]
        for pattern in patterns:
            match = re.search(pattern, response_text)
            if match:
                x, y = int(match.group(1)), int(match.group(2))
                if 0 <= x <= 1000 and 0 <= y <= 1000:
                    return (x, y)
        return None
