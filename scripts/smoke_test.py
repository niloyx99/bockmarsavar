"""Quick smoke test (run with DATABASE_URL, ADMIN_PASSWORD, SECRET_KEY set)."""

import asyncio

import httpx

from app.database import Base, engine
from app.main import app

Base.metadata.create_all(bind=engine)


async def _run() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        assert (await c.post("/api/auth/login", json={"password": "bad"})).status_code == 401
        assert (await c.post("/api/auth/login", json={"password": "secret"})).status_code == 200
        r = await c.get("/api/licenses")
        assert r.status_code == 200
        assert r.json() == []
        r = await c.post(
            "/api/licenses",
            json={"username": "u1", "plan": "Pro", "device_limit": 2},
        )
        assert r.status_code == 201, r.text
        key = r.json()["license_key"]
        lid = r.json()["id"]
        assert (await c.get("/validate", params={"license_key": key, "hwid": "hw1"})).json()["valid"] is True
        assert (await c.get("/validate", params={"license_key": key, "hwid": "hw2"})).json()["valid"] is True
        assert (await c.get("/validate", params={"license_key": key, "hwid": "hw3"})).json()["valid"] is False
        assert (await c.post(f"/api/licenses/{lid}/block")).json()["status"] == "blocked"
        assert (await c.get("/validate", params={"license_key": key, "hwid": "hw1"})).json()["valid"] is False
    print("smoke ok")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
