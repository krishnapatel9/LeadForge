"""Create a dashboard user, or reset an existing user's password.

Usage (from the repo root):
    python -m apps.api.scripts.create_user --email jane@agency.com --role ae --name "Jane Doe"

The password is asked for interactively (never pass it on the command line,
where it would land in shell history). Roles: admin, ae (approves outreach), ops.
"""

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import func
from sqlalchemy.future import select

from apps.api.auth.dependencies import ROLES
from apps.api.auth.security import MIN_PASSWORD_LENGTH, hash_password
from apps.api.db.session import SessionLocal
from apps.api.models.orm.organization import Organization
from apps.api.models.orm.user import User
from apps.api.services.normalize import normalize_email


def _read_password() -> str:
    while True:
        password = getpass.getpass(f"Password (min {MIN_PASSWORD_LENGTH} characters): ")
        if len(password) < MIN_PASSWORD_LENGTH:
            print(f"Too short. Use at least {MIN_PASSWORD_LENGTH} characters.")
            continue
        if getpass.getpass("Repeat password: ") != password:
            print("Passwords don't match.")
            continue
        return password


async def _run(email: str, role: str, name: str | None) -> None:
    async with SessionLocal() as db:
        org = (await db.execute(select(Organization).limit(1))).scalars().first()
        if org is None:
            org = Organization(name="Default Agency")
            db.add(org)
            await db.flush()

        user = (
            await db.execute(select(User).where(func.lower(User.email) == email))
        ).scalars().first()

        password_hash = hash_password(_read_password())
        if user:
            user.password_hash = password_hash
            user.role = role
            user.is_active = True
            if name:
                user.name = name
            action = "Updated"
        else:
            db.add(User(org_id=org.id, email=email, name=name, role=role,
                        password_hash=password_hash, is_active=True))
            action = "Created"

        await db.commit()
        print(f"{action} {role} user {email}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or reset a LeadForge dashboard user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--role", required=True, choices=ROLES)
    parser.add_argument("--name")
    args = parser.parse_args()

    email = normalize_email(args.email)
    if "@" not in email:
        sys.exit("Invalid email address.")
    asyncio.run(_run(email, args.role, args.name))


if __name__ == "__main__":
    main()
