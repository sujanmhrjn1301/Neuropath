def test_register_user(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "testpassword",
            "main_goal": "Learn AI"
        }
    )
    assert response.status_code == 200
    assert response.json() == {"message": "User successfully registered."}

def test_register_duplicate_user(client):
    # First registration
    client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "testpassword"
        }
    )
    # Second registration
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Test User 2",
            "email": "test@example.com",
            "password": "testpassword2"
        }
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered."

def test_login_success(client):
    client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "testpassword"
        }
    )
    response = client.post(
        "/api/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpassword"
        }
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_login_invalid_password(client):
    client.post(
        "/api/auth/register",
        json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "testpassword"
        }
    )
    response = client.post(
        "/api/auth/login",
        data={
            "username": "test@example.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."
