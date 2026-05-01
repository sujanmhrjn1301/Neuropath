import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # First login to get token
        resp = await client.post("http://127.0.0.1:8000/api/auth/token", data={"username": "test@test.com", "password": "password"})
        if resp.status_code != 200:
            print("Login failed, skipping test")
            return
        token = resp.json()["access_token"]
        
        # Test syllabus generate
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.post(
            "http://127.0.0.1:8000/api/syllabus/generate", 
            json={"goal": "Learn React", "use_openrouter": False},
            headers=headers
        )
        print(resp.status_code)
        print(resp.json())

asyncio.run(main())
