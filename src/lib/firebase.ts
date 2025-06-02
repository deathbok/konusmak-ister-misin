import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCsJryrYaMl-umM2tLNESCgLjUBWC3QNZI",
  authDomain: "konusmak-ister-misin.firebaseapp.com",
  databaseURL: "https://konusmak-ister-misin-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "konusmak-ister-misin",
  storageBucket: "konusmak-ister-misin.appspot.com",
  messagingSenderId: "433699843658",
  appId: "1:433699843658:web:26f92c2bc3914adedb40b3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const db = getDatabase(app);
