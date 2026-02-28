import torch
from transformers import AutoModel, AutoTokenizer, BitsAndBytesConfig

# 1. Setup paths
model_path = "OpenGVLab/InternVL2-8B"

# 2. Configure for 4-bit (Saves your GPU memory)
quant_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True
)

# 3. Load Tokenizer
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

# 4. Load Model with 'device_map'
# This is the most stable way to load on Windows
model = AutoModel.from_pretrained(
    model_path,
    quantization_config=quant_config,
    device_map="auto",             # Let the library handle placement
    trust_remote_code=True
).eval()

print("Success! The AI Brain is online and ready to see.")