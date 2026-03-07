from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Depends, Request, Body
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select, SQLModel
from sqlalchemy import Column, JSON
from sqlalchemy.orm.attributes import flag_modified
import hashlib

# Importações internas
from .database import engine, get_session
from .models import Personagem, Usuario

# ==============================================================================
# 1. LISTA MESTRA DE COMPETÊNCIAS (ATUALIZADA)
# ==============================================================================
LISTA_COMPETENCIAS = [
    "Vigor", "Manejo Animal", "Dissimulação", "Artimanha", 
    "Esoterismo", "Sagacidade", "Condução", "Reflexos", 
    "Fortitude", "Vontade", "Aristocracia", "Coordenação", 
    "Sobrevivência", "Medicina", "Profissão", "Idioma", "Atuação"
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as session:
            from sqlalchemy import text
            session.exec(text("ALTER TABLE personagem ADD COLUMN bonus_fisico INTEGER DEFAULT 0"))
            session.exec(text("ALTER TABLE personagem ADD COLUMN bonus_presenca INTEGER DEFAULT 0"))
            session.exec(text("ALTER TABLE personagem ADD COLUMN bonus_carisma INTEGER DEFAULT 0"))
            session.exec(text("ALTER TABLE personagem ADD COLUMN bonus_astucia INTEGER DEFAULT 0"))
            session.exec(text("ALTER TABLE personagem ADD COLUMN marca_hafa VARCHAR DEFAULT ''"))
            session.exec(text("ALTER TABLE personagem ADD COLUMN leque_destino JSON DEFAULT '[]'"))
            session.exec(text("ALTER TABLE personagem ADD COLUMN avatar TEXT DEFAULT ''"))
            session.exec(text("ALTER TABLE personagem ADD COLUMN usuario_id INTEGER DEFAULT NULL"))
            session.commit()
    except Exception:
        pass
    yield

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware

class ProxySchemeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Se o ngrok (ou outro proxy) roteou isso via HTTPS, forçamos o FastAPI a reconhecer como HTTPS
        if request.headers.get("x-forwarded-proto") == "https":
            request.scope["scheme"] = "https"
        return await call_next(request)

app = FastAPI(lifespan=lifespan)

app.add_middleware(ProxySchemeMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurações de Caminhos
BASE_DIR = Path(__file__).resolve().parent.parent 
TEMPLATES_DIR = BASE_DIR / "frontend" / "templates"
STATIC_DIR = BASE_DIR / "frontend" / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# ==============================================================================
# 2. UTILITÁRIOS
# ==============================================================================
def safe_int(value, default=0):
    try:
        if value is None or str(value).strip() == "":
            return default
        return int(value)
    except (ValueError, TypeError):
        return default

def get_current_user(request: Request, session: Session) -> Optional[Usuario]:
    user_id_str = request.cookies.get("giharad_user_id")
    if not user_id_str:
        return None
    try:
        user_id = int(user_id_str)
        return session.get(Usuario, user_id)
    except Exception:
        return None

# ==============================================================================
# 3. ROTAS DE VISUALIZAÇÃO E AUTH
# ==============================================================================
from fastapi import Form, Response

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "error": None})

@app.post("/login", response_class=HTMLResponse)
def login_action(request: Request, response: Response, username: str = Form(...), password: str = Form(...), session: Session = Depends(get_session)):
    stmt = select(Usuario).where(Usuario.username == username)
    user = session.exec(stmt).first()
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if not user or user.password_hash != password_hash:
        return templates.TemplateResponse("login.html", {"request": request, "error": "Usuário ou senha inválidos."})
    
    resp = RedirectResponse(url="/", status_code=303)
    resp.set_cookie(key="giharad_user_id", value=str(user.id), httponly=True)
    return resp

@app.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request, "error": None})

@app.post("/register", response_class=HTMLResponse)
def register_action(request: Request, response: Response, username: str = Form(...), password: str = Form(...), confirm_password: str = Form(...), session: Session = Depends(get_session)):
    if password != confirm_password:
        return templates.TemplateResponse("register.html", {"request": request, "error": "As senhas não coincidem."})
    
    stmt = select(Usuario).where(Usuario.username == username)
    existing_user = session.exec(stmt).first()
    if existing_user:
        return templates.TemplateResponse("register.html", {"request": request, "error": "Nome de usuário já existe."})
        
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    new_user = Usuario(username=username, password_hash=password_hash)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    resp = RedirectResponse(url="/", status_code=303)
    resp.set_cookie(key="giharad_user_id", value=str(new_user.id), httponly=True)
    return resp

@app.get("/logout")
def logout(response: Response):
    resp = RedirectResponse(url="/login", status_code=303)
    resp.delete_cookie("giharad_user_id")
    return resp

@app.get("/", response_class=HTMLResponse)
def home(request: Request, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    if not user:
        return RedirectResponse(url="/login", status_code=303)
        
    statement = select(Personagem).where(Personagem.usuario_id == user.id)
    resultados = session.exec(statement).all()
    return templates.TemplateResponse(
        name="index.html", 
        context={"request": request, "personagens": resultados, "usuario": user}
    )

@app.get("/ficha/{char_id}", response_class=HTMLResponse)
def visualizar_ficha(request: Request, char_id: int, session: Session = Depends(get_session)):
    personagem = session.get(Personagem, char_id)
    user = get_current_user(request, session)
    
    if not user:
        return RedirectResponse(url="/login", status_code=303)
        
    if not personagem or personagem.usuario_id != user.id: 
        return RedirectResponse(url="/", status_code=303)
    
    return templates.TemplateResponse(
        name="ficha.html", 
        context={
            "request": request, 
            "ficha": personagem, 
            "lista_skills": LISTA_COMPETENCIAS
        }
    )

@app.get("/novo")
def criar_personagem_direto(request: Request, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    if not user:
        return RedirectResponse(url="/login", status_code=303)
        
    novo_char = Personagem(
        nome="Nome",
        jogador="Jogador",
        raca="Espécie",
        classe="Classe",
        nivel=1,
        fisico=4, presenca=4, carisma=4, astucia=4,
        bonus_fisico=0, bonus_presenca=0, bonus_carisma=0, bonus_astucia=0,
        pv_max=10, pv_atual=10,
        pa_max=3, pa_atual=3,
        defesa=10,
        competencias={s: 0 for s in LISTA_COMPETENCIAS}, # Dicionário com acentos
        ataques=[], 
        habilidades=[], 
        inventario=[], 
        magias=[], 
        marca_hafa="",
        leque_destino=[],
        avatar="",
        notas="",
        usuario_id=user.id
    )
    
    try:
        session.add(novo_char)
        session.commit()
        session.refresh(novo_char)
        return RedirectResponse(url=f"/ficha/{novo_char.id}", status_code=303)
    except Exception as e:
        session.rollback()
        print(f"ERRO NO BANCO: {e}")
        return {"error": str(e)}

# ==============================================================================
# 4. ROTAS DE AÇÃO
# ==============================================================================

@app.post("/deletar/{char_id}")
def deletar_personagem(request: Request, char_id: int, session: Session = Depends(get_session)):
    user = get_current_user(request, session)
    if not user:
        return RedirectResponse(url="/login", status_code=303)
        
    personagem = session.get(Personagem, char_id)
    if personagem and personagem.usuario_id == user.id:
        session.delete(personagem)
        session.commit()
    return RedirectResponse(url="/", status_code=303)

@app.post("/api/atualizar_campo/{char_id}")
async def api_atualizar_campo(
    request: Request,
    char_id: int, 
    data: dict = Body(...), 
    session: Session = Depends(get_session)
):
    user = get_current_user(request, session)
    if not user:
        return {"status": "error", "message": "Não autenticado"}
        
    personagem = session.get(Personagem, char_id)
    if not personagem or personagem.usuario_id != user.id: 
        return {"status": "error"}
    
    try:
        for campo, valor in data.items():
            # Converte números se necessário
            int_fields = [
                'nivel', 'pv_max', 'pv_atual', 'pv_bonus', 'pa_max', 'pa_atual', 'pa_bonus', 'defesa', 
                'pg_max', 'pg_atual', 'pg_bonus', 'ph_max', 'ph_atual', 'ph_bonus', 'descansos_curtos',
                'fisico', 'presenca', 'carisma', 'astucia', 
                'bonus_fisico', 'bonus_presenca', 'bonus_carisma', 'bonus_astucia',
                'fisico_exp', 'fisico_inc', 'presenca_exp', 'presenca_inc',
                'carisma_exp', 'carisma_inc', 'astucia_exp', 'astucia_inc',
                'slots_nv1', 'slots_nv2', 'slots_nv3', 'slots_nv4', 'slots_nv5', 'slots_nv6',
                'slots_nv1_max', 'slots_nv2_max', 'slots_nv3_max', 'slots_nv4_max', 'slots_nv5_max', 'slots_nv6_max'
            ]
            if campo in int_fields:
                valor = safe_int(valor)
            
            if hasattr(personagem, campo):
                setattr(personagem, campo, valor)
                
                # Garante que o SQLAlchemy salve listas/dicionários
                if isinstance(valor, (list, dict)):
                    flag_modified(personagem, campo)
        
        session.add(personagem)
        session.commit()
        return {"status": "success"}
    
    except Exception as e:
        session.rollback()
        print(f"ERRO NO AUTO-SAVE: {e}")
        return {"status": "error", "message": str(e)}