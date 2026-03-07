from typing import Optional, Dict, List, Any
from sqlmodel import Field, SQLModel
from sqlalchemy import JSON, Column # Importamos Column também

# Função atualizada com acentos e separação de Idioma/Atuação
def default_competencias():
    return {
        "Vigor": 0, "Manejo Animal": 0, "Dissimulação": 0, "Artimanha": 0,
        "Esoterismo": 0, "Sagacidade": 0, "Condução": 0, "Reflexos": 0,
        "Fortitude": 0, "Vontade": 0, "Aristocracia": 0, "Coordenação": 0,
        "Sobrevivência": 0, "Medicina": 0, "Profissão": 0, "Idioma": 0, "Atuação": 0
    }

class Usuario(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str

class Personagem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuario.id")
    
    nome: str
    jogador: str
    raca: str
    classe: str
    nivel: int = 1
    
    antecedente: Optional[str] = None
    guardiao: Optional[str] = None
    ascensao: Optional[str] = None
    
    # Atributos Principais
    fisico: int
    presenca: int
    carisma: int
    astucia: int

    # Bônus/Penalidades dos Atributos
    bonus_fisico: int = Field(default=0)
    bonus_presenca: int = Field(default=0)
    bonus_carisma: int = Field(default=0)
    bonus_astucia: int = Field(default=0)

    # Expertise e Incapacidade
    fisico_exp: int = Field(default=0)
    fisico_inc: int = Field(default=0)
    presenca_exp: int = Field(default=0)
    presenca_inc: int = Field(default=0)
    carisma_exp: int = Field(default=0)
    carisma_inc: int = Field(default=0)
    astucia_exp: int = Field(default=0)
    astucia_inc: int = Field(default=0)

    # Status de Combate
    defesa: int = Field(default=10)
    experiencia: int = Field(default=0)

    pv_max: int = Field(default=10)
    pv_atual: int = Field(default=10)
    pv_bonus: int = Field(default=0)
    pa_max: int = Field(default=3)
    pa_atual: int = Field(default=3)
    pa_bonus: int = Field(default=0)
    ph_max: int = Field(default=0)
    ph_atual: int = Field(default=0)
    ph_bonus: int = Field(default=0)
    pg_max: int = Field(default=0)
    pg_atual: int = Field(default=0)
    pg_bonus: int = Field(default=0)

    marcadores_morte: int = 0  
    marcadores_fadiga: int = 0 
    marcadores_cicatrizes: int = 0 
    
    descansos_curtos: int = Field(default=0)

    # IMPORTANTE: Usando sa_column=Column(JSON) para estabilidade no SQLite
    competencias: Dict[str, int] = Field(
        default_factory=default_competencias, 
        sa_column=Column(JSON)
    )
    
    ataques: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    habilidades: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    inventario: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    
    notas: Optional[str] = Field(default="", sa_column_kwargs={"nullable": True})
    
    # Marca do Hafa / Leque do Destino
    marca_hafa: Optional[str] = Field(default="", sa_column_kwargs={"nullable": True})
    leque_destino: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    
    # Avatar / Foto de Perfil
    avatar: Optional[str] = Field(default="", sa_column_kwargs={"nullable": True})

    # Feitiçaria (Mantemos o nome técnico 'magia' no banco para evitar migrations complexas, 
    # mas o HTML chamará de Feitiço)
    tradicao: Optional[str] = Field(default="")
    escolas: Optional[str] = Field(default="")
    atributo_chave: str = Field(default="Astúcia")
    cd_magia: int = Field(default=10)
    
    slots_nv1: int = Field(default=0)
    slots_nv1_max: int = Field(default=0)
    slots_nv2: int = Field(default=0)
    slots_nv2_max: int = Field(default=0)
    slots_nv3: int = Field(default=0)
    slots_nv3_max: int = Field(default=0)
    slots_nv4: int = Field(default=0)
    slots_nv4_max: int = Field(default=0)
    slots_nv5: int = Field(default=0)
    slots_nv5_max: int = Field(default=0)
    slots_nv6: int = Field(default=0)
    slots_nv6_max: int = Field(default=0)
    
    magias: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))