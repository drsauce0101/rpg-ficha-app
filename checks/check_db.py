from sqlmodel import Session, select
from backend.models import Personagem, Usuario
from backend.database import engine

with Session(engine) as session:
    chars = session.exec(select(Personagem)).all()
    users = session.exec(select(Usuario)).all()

    with open('db_dump.txt', 'w', encoding='utf-8') as out:
        out.write('USERS:\n')
        for u in users:
            out.write(f'{u.id}: {u.username}\n')
            
        out.write('\nCHARS:\n')
        for c in chars:
            out.write(f'{c.id}: {c.nome} (User: {c.usuario_id})\n')
