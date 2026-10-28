import os
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings

def ingest_data():
    docs = [
        Document(page_content="Exercise Guidelines: Astronauts must exercise 2 hours daily. Use the Advanced Resistive Exercise Device (ARED) for 1 hour and the T2 Treadmill or CEVIS for 1 hour to prevent bone density loss.", metadata={"source": "nasa_exercise_manual"}),
        Document(page_content="Sleep Protocol: Aim for 8 hours of sleep per 24-hour period. If sleep is disturbed by noise, use provided earplugs. Melatonin may be taken under flight surgeon guidance if circadian rhythm is disrupted.", metadata={"source": "nasa_sleep_protocol"}),
        Document(page_content="Radiation Exposure: Stay in the heavily shielded quarters during solar particle events (SPE). Monitor personal dosimeter readings daily. Avoid unnecessary EVAs during high solar activity.", metadata={"source": "nasa_radiation_safety"}),
        Document(page_content="Nutrition: Consume 3000 calories per day on average. Ensure adequate intake of Vitamin D and Calcium. Dehydration can cause severe cognitive issues; drink at least 2.5 liters of water daily.", metadata={"source": "nasa_nutrition_guide"}),
        Document(page_content="Mental Health: Long duration isolation can cause psychological stress. Astronauts should maintain regular communication with family. If feelings of depression or high stress occur, schedule a private conference with the psychological support team immediately.", metadata={"source": "nasa_psychological_support"}),
        Document(page_content="Emergency Medical: For sudden cardiac issues, deploy the onboard AED. For minor cuts, use the standard med kit located in Node 1. All medical interventions must be logged and reported to ground control.", metadata={"source": "nasa_emergency_medical"})
    ]

    embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    persist_directory = "./chroma_db"
    
    print("Ingesting documents into ChromaDB...")
    vectorstore = Chroma.from_documents(docs, embeddings, persist_directory=persist_directory)
    print("Ingestion complete. Vector store saved at", persist_directory)

if __name__ == "__main__":
    ingest_data()
