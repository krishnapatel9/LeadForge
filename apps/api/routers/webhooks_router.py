import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.db.session import get_db
from apps.api.models.orm.lead import Lead
from apps.api.services.activity_service import log_activity

logger = logging.getLogger("leadforge.webhooks_router")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

class UnsubscribePayload(BaseModel):
    email: str

@router.post("/unsubscribe")
async def unsubscribe_webhook(
    payload: UnsubscribePayload,
    db: AsyncSession = Depends(get_db)
):
    email_clean = payload.email.strip().lower()
    
    # 1. Look up all leads with this email
    stmt = select(Lead).where(Lead.email == email_clean)
    result = await db.execute(stmt)
    leads = result.scalars().all()
    
    if not leads:
        logger.warning(f"Unsubscribe requested for unknown address: {email_clean}")
        # Return success anyway to avoid leaking user info / signaling 404 to validators
        return {"status": "unsubscribed", "email": email_clean, "matches": 0}
        
    # 2. Update do_not_contact for all instances
    updated_count = 0
    for lead in leads:
        if not lead.do_not_contact:
            lead.do_not_contact = True
            db.add(lead)
            
            # Log audit activity
            await log_activity(
                db=db,
                lead_id=lead.id,
                actor="System Webhook",
                action="opt_out",
                detail={"source": "unsubscribe_email_link"}
            )
            updated_count += 1
            
    await db.commit()
    logger.info(f"Successfully unsubscribed {email_clean} (updated {updated_count} leads)")
    
    return {
        "status": "unsubscribed",
        "email": email_clean,
        "matches": len(leads),
        "updated": updated_count
    }
