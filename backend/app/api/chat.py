from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import ChatMessage
from app.api.auth import get_current_user
from app.rag.pipeline import get_rag_chain
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.database import get_db

router = APIRouter()

from datetime import datetime

@router.post("/")
async def chat_with_maitri(
    message: ChatMessage,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    username = current_user.get("username", "Commander")

    # 1. Retrieve the authenticated user's latest health record from MongoDB (ONE SOURCE OF TRUTH)
    latest_record = None
    try:
        latest_record = await db.health_records.find_one(
            {"username": username},
            sort=[("timestamp", -1)]
        )
    except Exception as e:
        print(f"Error querying latest health record for chat: {e}")

    # 2. Construct authoritative health context from the real latest record
    if latest_record:
        health_score = latest_record.get("health_score")
        health_score_str = f"{health_score}/100" if health_score is not None else "unavailable"
        stress = latest_record.get("stress_prediction", "unavailable")
        emotion = latest_record.get("emotion", "unavailable")
        sleep_hours = latest_record.get("sleep_hours")
        sleep_str = f"{sleep_hours} hours" if sleep_hours is not None else "unavailable"
        sleep_quality = latest_record.get("sleep_quality", "unavailable")
        hr = latest_record.get("heart_rate")
        hr_str = f"{hr} BPM" if hr is not None else "unavailable"
        spo2 = latest_record.get("spo2")
        spo2_str = f"{spo2}%" if spo2 is not None else "unavailable"
        temp = latest_record.get("temperature")
        temp_str = f"{temp} °C" if temp is not None else "unavailable"
        bp = latest_record.get("blood_pressure", "unavailable")
        exercise = latest_record.get("exercise_duration")
        exercise_str = f"{exercise} minutes" if exercise is not None else "unavailable"
        weight = latest_record.get("weight")
        weight_str = f"{weight} kg" if weight is not None else "unavailable"
        activity = latest_record.get("activity", "Resting")
        water = latest_record.get("water_intake")
        water_str = f"{water}L (goal: 2.5L)" if water is not None else "not recorded"
        recommendation = latest_record.get("recommendation", "Nominal vitals. Maintain standard routine.")
        ts = latest_record.get("timestamp")
        time_str = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)

        health_context = (
            f"[Data logged at: {time_str}]\n"
            f"Overall health score: {health_score_str}\n"
            f"Stress level (ML prediction): {stress}\n"
            f"Logged emotion/mood: {emotion}\n"
            f"Sleep: {sleep_str} — quality: {sleep_quality}\n"
            f"Heart rate: {hr_str}\n"
            f"SpO2: {spo2_str}\n"
            f"Temperature: {temp_str}\n"
            f"Blood pressure: {bp}\n"
            f"Weight: {weight_str}\n"
            f"Exercise logged: {exercise_str}\n"
            f"Water intake: {water_str}\n"
            f"Current activity: {activity}\n"
            f"Wellness recommendation: {recommendation}\n"
            f"\nIMPORTANT: Use ONLY these values. Never invent or assume any metric not listed above."
        )
    else:
        health_context = (
            "No health record found for this user yet.\n"
            "If the user asks about their health or vitals, let them know naturally — "
            "something like: 'I don't have any health data from you yet. Once you log an entry "
            "from the Health Input page, I'll have a much clearer picture of how you're doing.'\n"
            "Do NOT fabricate or invent any health values under any circumstances."
        )

    # 3. Build conversation history from the client-side history payload
    # The frontend sends the last N turns so MAITRI can maintain context.
    history = []
    if message.history:
        for turn in message.history:
            history.append({"role": turn.role, "content": turn.content})

    # 4. Invoke RAG chain with user query, real health context, and conversation history
    try:
        chain = get_rag_chain()
        if not chain:
            raise RuntimeError("RAG chain uninitialized")

        response = chain({
            "input": message.content,
            "health_context": health_context,
            "history": history,
        })

        # 5. Save to chat history
        try:
            await db.chat_history.insert_one({
                "username": username,
                "user_message": message.content,
                "bot_reply": response,
                "timestamp": datetime.utcnow()
            })
        except Exception as e:
            print(f"MongoDB chat history error: {e}")

        return {"reply": response}
    except Exception as e:
        print(f"Chat generation error: {e}")
        # Fallback: friendly summary if LLM fails, still using real health data
        if latest_record:
            fallback = (
                f"Hey, I'm having a little trouble connecting right now — sorry about that.\n\n"
                f"From your latest data: health score is {health_score_str}, stress reads as "
                f"{stress.lower() if stress != 'unavailable' else 'unavailable'}, and you logged "
                f"{sleep_str} of sleep.\n\n"
                f"Give it a moment and try sending your message again — I'll be right here."
            )
            return {"reply": fallback}
        else:
            return {"reply": "Hey! I don't have any health data logged for you yet. Once you add an entry from the Health Input page, I'll be able to give you a much better picture of how you're doing."}
