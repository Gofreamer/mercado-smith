/* Global Smith — Firebase Config */

const firebaseConfig = {
  apiKey: "AIzaSyCBttq3QfezqC5y2KRI4kSs5VoUnAP90Zk",
  authDomain: "mercado-smith.firebaseapp.com",
  databaseURL: "https://mercado-smith-default-rtdb.firebaseio.com",
  projectId: "mercado-smith",
  storageBucket: "mercado-smith.firebasestorage.app",
  messagingSenderId: "1084544496126",
  appId: "1:1084544496126:web:6a3e7bdff7e246e88bd0af"
};

// Inicializa o Firebase (versão compat)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
