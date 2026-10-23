# ALLY - Digital Legal Engagement Platform

![Project Status](https://img.shields.io/badge/Status-Prototype-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.5-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-RAG-teal.svg)](https://fastapi.tiangolo.com/)

ALLY is a digital legal engagement platform for connecting clients with lawyers, managing legal cases, storing case documents, and supporting legal research through an AI assistant powered by retrieval-augmented generation (RAG).

The current prototype includes a Spring Boot backend, a React/Vite frontend, and a FastAPI RAG service that searches Philippine Supreme Court case data through Pinecone.

---

## Features

* **AI-powered legal assistant with RAG**: Answers Philippine legal questions using DeepSeek and retrieved Supreme Court case context from Pinecone.
* **2020-2026 Supreme Court case dataset**: The RAG dataset includes processed Philippine Supreme Court case CSVs, including 2025 and 2026 case data.
* **AI chat history**: Authenticated AI conversations are stored and can be reopened from the consultation page and legal workspace.
* **Legal workspace**: A case-centered workspace with Overview, Hearings, Documents, Notes, and AI Assistant tabs, a persistent case header, scrollable content panels, and a mobile case selector. Hearing bookings open in a side panel.
* **Shared hearing calendar**: Clients and their assigned lawyers can view case hearings in the workspace. Only the assigned lawyer can book hearings for accepted cases, including a date, time, court/location, and preparation notes. Hearings use Philippine time and retain past hearing history.
* **Case management**: Clients can submit cases, lawyers can accept or decline cases, and users can track case status.
* **Document management**: Users can upload, view, download, delete, and generate on-demand AI summaries for PDF, DOC, DOCX, TXT, and MD documents in accepted cases. Summary access follows the same case-participant permissions as document downloads.
* **Audit trail**: Admins and lawyers can review logged activity such as login events, case changes, document actions, and AI inquiries.
* **Email verification and notifications**: Brevo is used for account verification and email workflows.
* **OAuth support**: Google OAuth login is supported when OAuth environment variables are configured.
* **Local or Firebase-backed file storage**: Local storage is supported for development; Firebase Storage can be used when configured.

---

## Repository Structure

```text
Capstone-ALLY/
  Ally/               Spring Boot backend
  ally-frontend/      React + Vite frontend
  Ally-FinetuneRAG/   FastAPI RAG service and case dataset tools
  local-storage/      Local uploaded files during development
```

---

## Local Development

### Prerequisites

* Java 21+
* Maven
* Node.js and npm
* Python with virtual environment support
* MySQL 8
* Pinecone API key and index for RAG search
* DeepSeek API key for AI responses and classification

### 1. Clone the repository

```bash
git clone <repository_url>
cd Capstone-ALLY
```

### 2. Backend setup

Create or update `Ally/.env` with your local values:

```env
DB_URL=jdbc:mysql://localhost:3306/ally
DB_USERNAME=root
DB_PASSWORD=123456

DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
DOCUMENT_SUMMARY_MAX_CHARACTERS=60000

RAG_SERVICE_URL=http://localhost:8001
RAG_ENABLED=true
RAG_HEALTH_TIMEOUT=10000

STORAGE_TYPE=local
BREVO_API_KEY=your_brevo_api_key
BREVO_FROM_EMAIL=your_verified_sender
BREVO_FROM_NAME=Ally Team

FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:5173,http://localhost:5174,https://*.vercel.app
```

Run the backend from `Ally/`:

```bat
cd Ally
for /f "usebackq tokens=1,* delims==" %a in (".env") do set "%a=%b"
mvn spring-boot:run
```

Backend URL:

```text
http://localhost:8080
```

Swagger UI:

```text
http://localhost:8080/swagger-ui/index.html
```

### 3. RAG service setup

Create or update `Ally-FinetuneRAG/.env`:

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=ally-supreme-court-cases
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
HF_TOKEN=your_huggingface_token_optional
```

Start the RAG service:

```bat
cd Ally-FinetuneRAG
venv\Scripts\activate
for /f "usebackq tokens=1,* delims==" %a in (".env") do set "%a=%b"
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001
```

RAG URL:

```text
http://localhost:8001
```

Check backend-to-RAG status:

```text
http://localhost:8080/api/chat/health
```

Expected when RAG is running:

```json
{
  "status": "running",
  "ragService": "running"
}
```

### 4. Frontend setup

Create or update `ally-frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Run the frontend:

```bat
cd ally-frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

---

## RAG Dataset

The RAG data is stored under:

```text
Ally-FinetuneRAG/ally-dataset/csv-dataset/
```

The current local dataset includes yearly CSVs from 2020 through 2026:

```text
2020/2020.csv
2021/2021.csv
2022/2022.csv
2023/2023.csv
2024/2024.csv
2025/2025.csv
2026/2026.csv
```

Processed chunks are generated into:

```text
Ally-FinetuneRAG/processed-for-rag/chunks.jsonl
```

The processed RAG file is what gets embedded and uploaded to Pinecone. If the AI says it only knows data up to 2024, check that:

* RAG is enabled in the frontend.
* The RAG service is running on port `8001`.
* `RAG_SERVICE_URL` in `Ally/.env` points to `http://localhost:8001`.
* `RAG_ENABLED=true` is saved in `Ally/.env`, and the backend has been restarted after changing it.
* `RAG_HEALTH_TIMEOUT=10000` allows the Python service time to check Pinecone connectivity.
* The latest processed chunks have been uploaded to Pinecone.

---

## Architecture

```text
React Frontend (Vite - Port 5173)
       |
       v
Spring Boot Backend (Port 8080)
       |
       v
Ally-FinetuneRAG FastAPI (Port 8001)
       |
       v
Pinecone Vector DB + DeepSeek + BAAI/bge-large-en-v1.5 embeddings
```

The Spring Boot backend handles users, cases, documents, audit logs, AI chat history, email workflows, and authentication. The FastAPI RAG service handles query classification, embedding search, and retrieval from Pinecone.

---

## Tech Stack

* **Backend**: Java 21, Spring Boot 3.4.5, Spring Security, Spring Data JPA
* **Frontend**: React 18.3, Vite 6, Tailwind CSS, lucide-react
* **RAG service**: Python, FastAPI, sentence-transformers
* **Application database**: MySQL
* **Vector database**: Pinecone
* **AI model**: DeepSeek Flash-compatible chat endpoint
* **Embeddings**: [BAAI/bge-large-en-v1.5](https://huggingface.co/BAAI/bge-large-en-v1.5)
* **Email**: Brevo
* **File storage**: Local development storage or Firebase Storage

---

## Main Routes

Frontend:

```text
/login
/my-cases
/workspace
/documents
/documents/:caseId
/consult
/appointments
/lawyers
/admin
/admin/audit
```

Backend examples:

```text
POST /users/login
GET  /Cases/client/{clientId}
GET  /Cases/lawyer/{lawyerId}
GET  /api/documents/case/{caseId}
GET  /api/cases/{caseId}/hearings
POST /api/cases/{caseId}/hearings
POST /api/chat/prompt
GET  /api/chat/history
GET  /api/chat/health
GET  /api/audit-logs
```

---

## Useful Commands

Find and stop a process using port `8080`:

```bat
netstat -ano | findstr :8080
taskkill /PID <PID_HERE> /F
```

Build frontend:

```bat
cd ally-frontend
npm run build
```

Compile backend:

```bat
cd Ally
mvn -q -DskipTests compile
```

---

## Project Team

### Current Project Team

| Name | Role |
|------|------|
| Lumauag, Johanne Gabriel P. | RAG/Backend Developer |
| Alesna, Ervin Dione V. | UI/UX Developer |
| Butihen, Joseph Harry G. | Backend Developer |
| Dioquino, John Lawrence L. | Frontend Developer |
| Ortega, Harvey A. | Frontend Developer |

### Original Project Team

| Profile | Name | Role | GitHub Username |
|---------|------|------|-----------------|
| <img src="https://avatars.githubusercontent.com/u/104577324?v=4" width="50"> | Vicci Louise Agramon | Backend Developer | [@Xansxxx3](https://github.com/Xansxxx3) |
| <img src="https://avatars.githubusercontent.com/u/114855573?v=4" width="50"> | Piolo Frances Enriquez | Lead/Frontend Developer | [@piolonrqz](https://github.com/piolonrqz) |
| <img src="https://avatars.githubusercontent.com/u/112413548?v=4" width="50"> | Darwin Darryl Largoza | UI/UX Designer | [@Dadaisuk1](https://github.com/Dadaisuk1) |
| <img src="https://avatars.githubusercontent.com/u/89176351?v=4" width="50"> | Nathan Rener Malagapo | Backend & RAG/AI Developer | [@sytrusz](https://github.com/sytrusz) |
| <img src="https://avatars.githubusercontent.com/u/154393634?v=4" width="50"> | Jerjen Res Pangalay | Backend/Frontend Developer | [@jerjenres](https://github.com/jerjenres) |

---

## Acknowledgments

* Philippine Supreme Court e-Library for source case data: [https://elibrary.judiciary.gov.ph/thebookshelf/](https://elibrary.judiciary.gov.ph/thebookshelf/)
* Pinecone for vector database services
* DeepSeek for chat and classification
* [BAAI/bge-large-en-v1.5](https://huggingface.co/BAAI/bge-large-en-v1.5)
* [sentence-transformers](https://huggingface.co/sentence-transformers)

---

## Citation

```bibtex
@misc{bge_embedding,
      title={C-Pack: Packaged Resources To Advance General Chinese Embedding},
      author={Shitao Xiao and Zheng Liu and Peitian Zhang and Niklas Muennighoff},
      year={2023},
      eprint={2309.07597},
      archivePrefix={arXiv},
      primaryClass={cs.CL}
}
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

**Copyright (c) 2025 Team 23 - ALLY Development Team**

---

## Disclaimer

**This is legal information, not legal advice.** ALLY provides general information about Philippine law based on available Supreme Court cases and retrieved legal context. For specific legal situations, consult a licensed Philippine lawyer.

---

## Contact

For inquiries or feedback, contact the project team through their GitHub profiles listed above.
