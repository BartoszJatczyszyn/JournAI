Local models directory

Place your GGUF model files here. This folder is mounted read-only into the llama.cpp server container at /models.

Recommended model
- Name: Mistral-7B-OpenOrca Q4_K_M (GGUF)
- Expected filename (default in docker-compose): mistral-7b-openorca.Q4_K_M.gguf
- Size: ~4–5 GB

Where to get it
- Hugging Face: TheBloke/Mistral-7B-OpenOrca-GGUF
- Example direct link (check the repo for latest):
  https://huggingface.co/TheBloke/Mistral-7B-OpenOrca-GGUF/resolve/main/mistral-7b-openorca.Q4_K_M.gguf

Usage
1) Download the file into this directory: AI/models/mistral-7b-openorca.Q4_K_M.gguf
2) Start the stack:
   ./start_all.sh
3) Test LLM health:
   curl -s http://localhost:8080/v1/models | jq .
4) Test backend LLM endpoint:
   curl -s http://localhost:5002/api/llm/health | jq .

Notes
- CPU-only by default (ngl=0). If you have a GPU build of llama.cpp, adjust -ngl accordingly in AI/docker-compose.yml.
- You can change model filename/params in docker-compose (llm service) and backend LLM_MODEL env.
