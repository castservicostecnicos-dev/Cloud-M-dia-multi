import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const config = {
  projectId: 'deep-freedom-8szp9',
  apiKey: 'AIzaSyCzP6rv9WIneoF9OUDTRppATOsCLOS-vvQ',
  appId: '1:676316244483:web:bc8f3491e953b884c9fc36',
  authDomain: 'deep-freedom-8szp9.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixmdiaindoor2-b21786e5-9cc2-4541-8854-9ca7fb6c84ba',
};

const app = initializeApp(config, 'cloner-app');
const db = getFirestore(app, config.firestoreDatabaseId);

async function cloneDatabase() {
  console.log('[Clone] Lendo banco original de app_data/indoor_media_db...');
  const sourceDoc = doc(db, 'app_data', 'indoor_media_db');
  const snap = await getDoc(sourceDoc);

  if (!snap.exists()) {
    console.error('[Clone] Documento original não encontrado!');
    process.exit(1);
  }

  const raw = snap.data();
  const parsedData = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data;

  console.log('[Clone] Dados lidos com sucesso!');
  console.log(`- Empresas: ${parsedData.companies?.length || 0}`);
  console.log(`- Players: ${parsedData.players?.length || 0}`);
  console.log(`- Playlists: ${parsedData.playlists?.length || 0}`);
  console.log(`- Usuários: ${parsedData.users?.length || 0}`);
  console.log(`- Mídias: ${parsedData.media?.length || 0}`);

  // 1. Salvar backup local no arquivo data/indoor_media.json
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const localFilePath = path.join(dataDir, 'indoor_media.json');
  fs.writeFileSync(localFilePath, JSON.stringify(parsedData, null, 2), 'utf-8');
  console.log(`[Clone] Backup local salvo em: ${localFilePath}`);

  // 2. Gravar cópia no Firestore no documento independente 'indoor_media_cloudflare_db' na coleção 'app_data'
  // estritamente de acordo com o esquema exigido pelas firestore.rules
  const serialized = JSON.stringify(parsedData);
  const now = new Date().toISOString();

  const payload = {
    version: 1,
    updated_at: now,
    stats: {
      users: parsedData.users?.length || 0,
      companies: parsedData.companies?.length || 0,
      players: parsedData.players?.length || 0,
      playlists: parsedData.playlists?.length || 0,
      media: parsedData.media?.length || 0,
    },
    data: serialized,
  };

  const targetDoc = doc(db, 'app_data', 'indoor_media_cloudflare_db');
  await setDoc(targetDoc, payload);
  console.log('[Clone] Cópia independente salva com sucesso no Firestore: app_data/indoor_media_cloudflare_db');

  console.log('[Clone] CLONAGEM CONCLUÍDA COM SUCESSO! O app agora possui um banco 100% independente.');
}

cloneDatabase().catch((err) => {
  console.error('[Clone] Erro durante a clonagem:', err);
  process.exit(1);
});
