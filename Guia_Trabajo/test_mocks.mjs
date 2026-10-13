import * as fsMock from "./mocks/firebase_firestore.js";
import * as authMock from "./mocks/firebase_auth.js";

// Simular el flujo exacto de App.tsx
const db = fsMock.getFirestore({});
const auth = authMock.getAuth({});

authMock.onAuthStateChanged(auth, async (currentUser) => {
  if (currentUser) {
    try {
      const userDoc = await fsMock.getDoc(fsMock.doc(db, "users", currentUser.uid));
      console.log("exists:", userDoc.exists());
      const data = userDoc.data();
      console.log("data:", JSON.stringify(data));
      const role = (data?.role || "").toLowerCase();
      console.log("role:", role);
    } catch (e) {
      console.log("CATCH:", e.message);
    }
  }
});

const res = await authMock.signInWithEmailAndPassword(auth, "jherrera@cesfamrodelillo.cl", "demo123");
console.log("uid:", res.user.uid);
await new Promise((r) => setTimeout(r, 500));
process.exit(0);
