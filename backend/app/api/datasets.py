import io
import os
import csv
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from langchain_core.documents import Document
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.api.auth import get_current_user
from app.rag.pipeline import vectorstore

router = APIRouter()

def parse_pdf(file_bytes: bytes) -> str:
    try:
        import pypdf
        pdf_file = io.BytesIO(file_bytes)
        reader = pypdf.PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="PDF parsing library (pypdf) is not installed in the environment."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF file: {str(e)}")

def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    ext = os.path.splitext(filename.lower())[1]
    try:
        if ext in [".txt", ".md"]:
            return file_bytes.decode("utf-8", errors="ignore")
        elif ext == ".csv":
            text_stream = io.StringIO(file_bytes.decode("utf-8", errors="ignore"))
            reader = csv.reader(text_stream)
            rows = list(reader)
            if not rows:
                return ""
            headers = rows[0]
            row_texts = []
            for row in rows[1:]:
                # Map headers to values
                row_str = ", ".join([f"{headers[i]}: {row[i]}" if i < len(headers) else row[i] for i in range(len(row))])
                row_texts.append(row_str)
            return "\n".join(row_texts)
        elif ext == ".json":
            data = json.loads(file_bytes.decode("utf-8", errors="ignore"))
            if isinstance(data, list):
                return "\n".join([json.dumps(item) for item in data])
            else:
                return json.dumps(data, indent=2)
        elif ext == ".pdf":
            return parse_pdf(file_bytes)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Failed to decode file content as UTF-8.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file structure.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {str(e)}")

def format_size(size_in_bytes: int) -> str:
    if size_in_bytes < 1024:
        return f"{size_in_bytes} B"
    elif size_in_bytes < 1024 * 1024:
        return f"{size_in_bytes / 1024:.2f} KB"
    else:
        return f"{size_in_bytes / (1024 * 1024):.2f} MB"

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if vectorstore is None:
        raise HTTPException(status_code=500, detail="Vector store (ChromaDB) is not loaded or configured.")

    filename = file.filename
    # Read file contents and compute size
    file_bytes = await file.read()
    file_size = len(file_bytes)
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Cannot upload an empty file.")

    # Check for existing documents with same source
    try:
        existing_docs = vectorstore.get()
        for meta in existing_docs.get("metadatas", []):
            if meta and meta.get("source") == filename:
                raise HTTPException(
                    status_code=400, 
                    detail=f"A dataset with the filename '{filename}' already exists. Please delete it first or rename your file."
                )
    except HTTPException as he:
        raise he
    except Exception as e:
        # Ignore errors during duplicate check, proceed to upload
        print(f"Duplicate check failed: {e}")

    # Extract text from file
    text_content = extract_text_from_file(filename, file_bytes)
    if not text_content.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the file.")

    # Split text into chunks
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = splitter.split_text(text_content)
    
    if not chunks:
        raise HTTPException(status_code=400, detail="Text splitting resulted in zero chunks.")

    # Create Document structures
    docs = [
        Document(
            page_content=chunk,
            metadata={
                "source": filename,
                "filename": filename,
                "file_size": format_size(file_size),
                "uploaded_at": datetime.utcnow().isoformat(),
                "user": current_user.get("username", "Commander")
            }
        )
        for chunk in chunks
    ]

    try:
        # Ingest documents into ChromaDB
        vectorstore.add_documents(docs)
        return {
            "message": f"Successfully ingested '{filename}' into knowledge base.",
            "filename": filename,
            "chunks_created": len(docs),
            "size": format_size(file_size)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save document to vector store: {str(e)}")

@router.get("")
async def list_datasets(current_user: dict = Depends(get_current_user)):
    if vectorstore is None:
        return []

    try:
        # Get all records from ChromaDB
        results = vectorstore.get()
        metadatas = results.get("metadatas", [])
        
        datasets = {}
        for meta in metadatas:
            if not meta:
                continue
            
            source = meta.get("source", "System Default")
            
            if source not in datasets:
                datasets[source] = {
                    "name": source,
                    "chunks": 0,
                    "uploaded_at": meta.get("uploaded_at", "System Default"),
                    "file_size": meta.get("file_size", "N/A"),
                    "user": meta.get("user", "System")
                }
            datasets[source]["chunks"] += 1
            
        return list(datasets.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read datasets from vector store: {str(e)}")

@router.delete("/{filename}")
async def delete_dataset(
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    if vectorstore is None:
        raise HTTPException(status_code=500, detail="Vector store is not loaded.")

    try:
        results = vectorstore.get()
        ids_to_delete = []
        
        for i, meta in enumerate(results.get("metadatas", [])):
            if meta and meta.get("source") == filename:
                ids_to_delete.append(results["ids"][i])
                
        if not ids_to_delete:
            raise HTTPException(status_code=404, detail="Dataset not found or already deleted.")
            
        # Delete from ChromaDB
        vectorstore.delete(ids=ids_to_delete)
        return {"message": f"Successfully deleted dataset '{filename}' from knowledge base."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete dataset: {str(e)}")
