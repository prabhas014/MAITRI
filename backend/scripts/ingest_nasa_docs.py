import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from langchain_community.document_loaders import TextLoader
from langchain_chroma import Chroma
from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings
from langchain_core.documents import Document

def ingest_docs():
    print("Ingesting NASA Knowledge Base...")
    
    docs = [
        Document(
            page_content="NASA Exercise Manual: Astronauts should perform at least 2 hours of resistance training daily to prevent muscle atrophy in microgravity. If fatigue risk is HIGH, reduce cardiovascular exercise and focus on light stretching.",
            metadata={"source": "Exercise Manual"}
        ),
        Document(
            page_content="NASA Radiation Handbook: During solar flares, astronauts must seek shelter in the designated radiation safe zone. Normal background radiation is managed through the hull shielding.",
            metadata={"source": "Radiation Handbook"}
        ),
        Document(
            page_content="NASA Sleep Guidelines: Ensure a dark, quiet environment for sleep. A minimum of 8 hours of sleep opportunity is required. If sleep quality is poor, a 5-minute breathing exercise is recommended before the next sleep cycle.",
            metadata={"source": "Sleep Guidelines"}
        ),
        Document(
            page_content="NASA Emergency Medical Guide: If an astronaut reports high stress and poor sleep, notify mission control immediately and start the fatigue mitigation protocol, which includes reduced workload.",
            metadata={"source": "Emergency Medical Guide"}
        ),
        Document(
            page_content="NASA Nutrition Guide: Consume at least 2.5 liters of water daily. Ensure adequate intake of Vitamin D and Calcium to support bone health in space.",
            metadata={"source": "Nutrition Guide"}
        )
    ]
    
    embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    persist_directory = os.path.join(os.path.dirname(__file__), '..', 'chroma_db')
    
    vectorstore = Chroma.from_documents(
        documents=docs, 
        embedding=embeddings, 
        persist_directory=persist_directory
    )
    
    print(f"Successfully ingested {len(docs)} documents into ChromaDB.")

if __name__ == "__main__":
    ingest_docs()
