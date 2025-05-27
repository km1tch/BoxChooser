from pydantic import BaseModel


class LoginRequest(BaseModel):
    store_id: str
    pin: str


class EmailCodeRequest(BaseModel):
    store_id: str
    email: str


class VerifyCodeRequest(BaseModel):
    store_id: str
    email: str
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UpdateEmailRequest(BaseModel):
    email: str