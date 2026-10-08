import { App, cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

let app: App | undefined;

function initApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    undefined;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const sa = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    app = initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key?.replace(/\\n/g, "\n"),
      }),
      storageBucket,
    });
  } else {
    app = initializeApp({
      credential: applicationDefault(),
      storageBucket,
    });
  }

  return app;
}

export function getAdminDb(): Firestore {
  return getFirestore(initApp());
}

export function getAdminStorage(): Storage {
  return getStorage(initApp());
}

export function getStorageBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucketName
    ? getAdminStorage().bucket(bucketName)
    : getAdminStorage().bucket();
}
