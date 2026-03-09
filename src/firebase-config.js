import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBH84XoNKxRy83EEE9c4CnP2C2k3uQY-eE",
  authDomain:        "aidle-hero.firebaseapp.com",
  projectId:         "aidle-hero",
  storageBucket:     "aidle-hero.firebasestorage.app",
  messagingSenderId: "112450189421",
  appId:             "1:112450189421:web:7f78883e516e279890e764"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
