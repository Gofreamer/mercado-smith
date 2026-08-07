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

// reCAPTCHA Enterprise site key (App Check) — pública no front
const RECAPTCHA_ENTERPRISE_SITE_KEY = "6Lc7HHktAAAAEEGKR8uD0Az8-n-QeHAPZ2aqNGV";

// Inicializa o Firebase (versão compat)
firebase.initializeApp(firebaseConfig);

// App Check (necessário para Firebase AI Logic)
try {
  const appCheck = firebase.appCheck();
  appCheck.activate(
    new firebase.appCheck.ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
    true // auto-refresh do token
  );
} catch (err) {
  console.warn("App Check não inicializou:", err);
}

const auth = firebase.auth();
const db = firebase.database();
