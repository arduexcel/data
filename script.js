const config1 = {
  apiKey: "AIzaSyCuUstd-6d0E-EbmQipv2mWk-bA55ajpQ0",
  authDomain: "car-system-4594d.firebaseapp.com",
  projectId: "car-system-4594d",
  storageBucket: "car-system-4594d.firebasestorage.app",
  messagingSenderId: "719030469585",
  appId: "1:719030469585:web:7a23645b9e684b727dd6f0",
};

const app1 = firebase.initializeApp(config1, "a1");
const db1 = app1.firestore();

let allCars = [];
let todayInvoicesList = []; // بۆ پاشەکەوتکردنی تەواوی وەسڵەکانی ئەمڕۆ بە مەبەستی پشکنینی خێرا
let currentMode = "normal";
let currentUser = localStorage.getItem("terminalUser") || "";
let selectedCarProvince = "";

const specialCarOptions = {
  38955: [
    { label: "سلێمانی", note: "38955 سلێمانی" },
    { label: "هەولێر", note: "38955 هەولێر" },
  ],
  10627: [
    { label: "11 N ", note: " ١٠٦٢٧ N ١١ " },
    { label: "11 W ", note: " ١٠٦٢٧ W ١١ " },
  ],
};

// --- Local day-cache ---
let localMaxInvoiceNo = parseInt(localStorage.getItem("localMaxInvoiceNo")) || 0;
let localCount = parseInt(localStorage.getItem("localCount")) || 0;
let localMoney = parseInt(localStorage.getItem("localMoney")) || 0;
let cacheDay = localStorage.getItem("cacheDay") || null;

const getTodayStr = () => new Date().toLocaleDateString("en-CA");

// هێنانی داتاکان لە سێرڤەرەوە و خەزنکردنی لیستی وەسڵەکانی ئەمڕۆ
async function loadDayCache() {
  const today = getTodayStr();
  
  if (cacheDay !== today) {
    localCount = 0;
    localMoney = 0;
    localMaxInvoiceNo = 0;
    todayInvoicesList = [];
    cacheDay = today;
    localStorage.setItem("cacheDay", today);
    localStorage.removeItem("todayInvoicesList");
    saveStatsToLocalStorage();
  } else {
    // ئەگەر ڕۆژەکە نەگۆڕابوو، لیستەکە لە لۆکاڵەوە بار دەکات بۆ ئەوەی خێرا بێت
    const savedList = localStorage.getItem("todayInvoicesList");
    if (savedList) todayInvoicesList = JSON.parse(savedList);
  }

  if (!navigator.onLine) {
    return;
  }

  try {
    const snap = await db1
      .collection("Invoices")
      .doc(today)
      .collection("AllInvoices")
      .get();
    let maxNo = 0,
      cnt = 0,
      money = 0;
    
    todayInvoicesList = [];
    
    snap.forEach((doc) => {
      const d = doc.data();
      todayInvoicesList.push(d); // خەزنکردنی داتاکان بۆ پشکنینی دووبارە بوونەوە
      const no = parseInt(d.invoiceNo);
      if (!isNaN(no) && no > maxNo) maxNo = no;
      if (d.employee === currentUser && d.status === "active") {
        money += parseInt(d.price || 0);
        cnt++;
      }
    });
    
    if (maxNo >= localMaxInvoiceNo) {
      localMaxInvoiceNo = maxNo;
    }
    localCount = cnt;
    localMoney = money;
    
    localStorage.setItem("localMaxInvoiceNo", localMaxInvoiceNo);
    localStorage.setItem("todayInvoicesList", JSON.stringify(todayInvoicesList));
    saveStatsToLocalStorage();
  } catch (e) {
    console.log("هەڵە لە بارکردنی کاش لە سێرڤەرەوە:", e.message);
  }
}

function saveStatsToLocalStorage() {
  localStorage.setItem("localCount", localCount);
  localStorage.setItem("localMoney", localMoney);
}

function updateStatsDisplay() {
  document.getElementById("totalCount").innerText = localCount;
  document.getElementById("totalMoney").innerText =
    localMoney.toLocaleString() + " د.ع";
}

window.onload = async () => {
  // دروستکردنی ئێلیمێنتی نیشاندانی ئاگادارکردنەوەی ئۆتۆمبێلی دووبارە لە ژێر ئینپوتەکە
  const carNumInput = document.getElementById("carNumberInput");
  if (carNumInput) {
    const warningDiv = document.createElement("div");
    warningDiv.id = "duplicateCarWarning";
    warningDiv.style.color = "red";
    warningDiv.style.fontWeight = "bold";
    warningDiv.style.marginTop = "5px";
    warningDiv.style.display = "none";
    warningDiv.innerText = "⚠️ ئەم ئۆتۆمبێلە پێشتر لەم ڕۆژەدا وەسڵی بۆ بڕدراوە!";
    carNumInput.parentNode.insertBefore(warningDiv, carNumInput.nextSibling);
  }

  const cachedCars = localStorage.getItem("cachedCars");
  if (cachedCars) {
    allCars = JSON.parse(cachedCars);
  }
  const cachedEmployees = localStorage.getItem("cachedEmployees");
  if (cachedEmployees) {
    renderEmployeesSelect(JSON.parse(cachedEmployees));
  }

  if (navigator.onLine) {
    try {
      const empSnap = await db1.collection("Employees").get();
      const emps = [];
      empSnap.forEach((doc) => {
        emps.push(doc.data());
      });
      localStorage.setItem("cachedEmployees", JSON.stringify(emps));
      renderEmployeesSelect(emps);

      const carSnap = await db1.collection("Cars").get();
      allCars = carSnap.docs.map((doc) => doc.data());
      localStorage.setItem("cachedCars", JSON.stringify(allCars));
    } catch (e) {
      console.log("هەڵە لە هێنانی داتای نوێ لە سێرڤەرەوە:", e.message);
    }
  }

  if (currentUser) {
    showMainApp();
  }

  window.addEventListener('online', syncOfflineQueue);
  if (navigator.onLine) {
    syncOfflineQueue();
  }
};

function renderEmployeesSelect(emps) {
  const select = document.getElementById("userSelect");
  select.innerHTML = '<option value="">ناو هەڵبژێرە...</option>';
  emps.forEach((emp) => {
    if (emp.role === "staff" || emp.name === "admin") {
      select.innerHTML += `<option value="${emp.name}">${emp.name}</option>`;
    }
  });
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    const num = document.getElementById("carNumberInput").value;
    const price = document.getElementById("resPrice").value;
    if (
      num &&
      price &&
      document.getElementById("main-content").style.display !== "none"
    ) {
      handleAction();
    }
  }
});

async function login() {
  const name = document.getElementById("userSelect").value;
  const pass = document.getElementById("userPass").value;
  if (!name || !pass) return alert("ناو و پاسۆرد بنووسە");
  
  if (name === "admin" && pass === "0055") {
    successLogin(name);
    return;
  }

  if (navigator.onLine) {
    try {
      const snap = await db1
        .collection("Employees")
        .where("name", "==", name)
        .where("password", "==", pass)
        .get();
      if (!snap.empty) {
        successLogin(name);
      } else {
        alert("پاسۆردەکە هەڵەیە!");
      }
    } catch (e) {
      fallbackLogin(name, pass);
    }
  } else {
    fallbackLogin(name, pass);
  }
}

function fallbackLogin(name, pass) {
  const cachedEmployees = localStorage.getItem("cachedEmployees");
  if (cachedEmployees) {
    const emps = JSON.parse(cachedEmployees);
    const found = emps.find(emp => emp.name === name && emp.password === pass);
    if (found) {
      successLogin(name);
    } else {
      alert("پاسۆردەکە هەڵەیە یاخود داتای ناوخۆیی نییە!");
    }
  } else {
    alert("هێڵ نییە و داتای پێشوو خەزن نەکراوە!");
  }
}

function successLogin(name) {
  currentUser = name;
  localStorage.setItem("terminalUser", name);
  showMainApp();
}

async function showMainApp() {
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("main-content").style.display = "block";
  document.getElementById("displayEmployeeName").innerText =
    "بەکارهێنەر: " + currentUser;
  await loadDayCache();
  updateStatsDisplay();
  document.getElementById("carNumberInput").focus();
}

function logout() {
  localStorage.removeItem("terminalUser");
  currentUser = "";
  document.getElementById("main-content").style.display = "none";
  document.getElementById("login-overlay").style.display = "flex";
  location.reload();
}

function searchCarLocally(num) {
  const listDiv = document.getElementById("carMatchList");
  const warningDiv = document.getElementById("duplicateCarWarning");
  listDiv.innerHTML = "";
  listDiv.style.display = "none";
  
  updateProvinceButtonsVisibility(num);
  
  // لۆجیکی پشکنینی وەسڵی پێشوو لەمڕۆدا بۆ ئەم ژمارەیە
  if (num && todayInvoicesList.length > 0) {
    const isDuplicate = todayInvoicesList.some(inv => String(inv.carNumber).trim() === String(num).trim() && inv.status === "active");
    if (isDuplicate) {
      if (warningDiv) warningDiv.style.display = "block";
    } else {
      if (warningDiv) warningDiv.style.display = "none";
    }
  } else {
    if (warningDiv) warningDiv.style.display = "none";
  }

  if (currentMode === "parking" || !num) {
    clearCarFields();
    return;
  }
  const matches = allCars.filter((c) => String(c.number) === String(num));
  if (matches.length === 1) {
    setCarData(matches[0]);
  } else if (matches.length > 1) {
    listDiv.style.display = "block";
    matches.forEach((m) => {
      const div = document.createElement("div");
      div.className = "match-item";
      div.innerHTML = `<span>هێڵی: ${m.line} (${m.type})</span> <span>${m.price} د.ع</span>`;
      div.onclick = () => {
        setCarData(m);
        listDiv.style.display = "none";
      };
      listDiv.appendChild(div);
    });
  } else {
    clearCarFields();
  }
}

function updateProvinceButtonsVisibility(num) {
  const provinceButtons = document.getElementById("provinceButtons");
  if (!provinceButtons) return;

  const options = specialCarOptions[String(num).trim()];
  const shouldShow = Boolean(options);
  provinceButtons.style.display = shouldShow ? "flex" : "none";

  if (!shouldShow) {
    selectedCarProvince = "";
    provinceButtons
      .querySelectorAll("button")
      .forEach((btn) => btn.classList.remove("active"));
    return;
  }

  document.getElementById("carOptionOne").innerText = options[0].label;
  document.getElementById("carOptionTwo").innerText = options[1].label;
  provinceButtons
    .querySelectorAll("button")
    .forEach((btn) => btn.classList.remove("active"));
}

function selectCarProvince(optionIndex) {
  const num = document.getElementById("carNumberInput").value.trim();
  const option = specialCarOptions[num]?.[optionIndex];
  if (!option) return;

  selectedCarProvince = option.label;
  const noteInput = document.getElementById("resNote");
  noteInput.value = option.note;

  document
    .querySelectorAll("#provinceButtons button")
    .forEach((btn) => btn.classList.remove("active"));
  const activeButton = document.getElementById(
    optionIndex === 0 ? "carOptionOne" : "carOptionTwo",
  );
  if (activeButton) activeButton.classList.add("active");
}

function clearCarFields() {
  document.getElementById("resLine").value = "";
  if (currentMode === "normal") {
    document.getElementById("resType").value = "";
    document.getElementById("resPrice").value = "";
    document.getElementById("btnHalf").style.display = "none";
  }
}

function setCarData(match) {
  document.getElementById("resLine").value = match.line;
  document.getElementById("resType").value = match.type;
  if (currentMode === "normal") {
    document.getElementById("resPrice").value = match.price;
    document.getElementById("btnHalf").style.display =
      match.type === "پاس" ? "block" : "none";
  }
}

function toggleMode(mode) {
  if (mode === "report") {
    var modal = document.getElementById("myModal");
    var iframe = document.getElementById("reportFrame");
    iframe.src =
      "https://arduexcel.github.io/data12/?user=" +
      encodeURIComponent(currentUser);
    modal.style.display = "block";
    return;
  }
  if (currentMode === mode) {
    currentMode = "normal";
    document.getElementById("parkingModeBtn").classList.remove("mode-active");
    document.getElementById("fineModeBtn").classList.remove("mode-active");
    document.getElementById("monthlyModeBtn").classList.remove("mode-active");
  } else {
    currentMode = mode;
    document
      .getElementById("parkingModeBtn")
      .classList.toggle("mode-active", mode === "parking");
    document
      .getElementById("fineModeBtn")
      .classList.toggle("mode-active", mode === "fine");
    document
      .getElementById("monthlyModeBtn")
      .classList.toggle("mode-active", mode === "monthly");
  }
  const priceField = document.getElementById("resPrice");
  const lineField = document.getElementById("resLine");
  const lineSelect = document.getElementById("resLineSelect");
  const typeField = document.getElementById("resType");
  const typeSelect = document.getElementById("resTypeSelect");
  const noteField = document.getElementById("resNote");
  const monthlyDates = document.getElementById("monthly-dates");
  if (currentMode === "parking") {
    priceField.readOnly = false;
    lineField.readOnly = true;
    typeField.readOnly = true;
    lineField.style.display = "";
    lineSelect.style.display = "none";
    typeField.style.display = "";
    typeSelect.style.display = "none";
    lineField.value = "پارکینگ";
    typeField.value = "پارکینگ";
    noteField.value = "";
    monthlyDates.style.display = "none";
  } else if (currentMode === "fine") {
    priceField.readOnly = false;
    lineField.readOnly = true;
    typeField.readOnly = true;
    lineField.style.display = "";
    lineSelect.style.display = "none";
    typeField.style.display = "";
    typeSelect.style.display = "none";
    lineField.value = "";
    typeField.value = "غەرامە";
    noteField.value = "غەرامە";
    monthlyDates.style.display = "none";
  } else if (currentMode === "monthly") {
    priceField.readOnly = false;
    lineField.style.display = "none";
    lineSelect.style.display = "";
    lineSelect.value = "";
    typeField.style.display = "none";
    typeSelect.style.display = "";
    typeSelect.value = "";
    noteField.value = "مانگانەی بۆ کراوە";
    monthlyDates.style.display = "flex";
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    document.getElementById("resFromDate").value =
      today.toLocaleDateString("en-CA");
    document.getElementById("resToDate").value =
      nextMonth.toLocaleDateString("en-CA");
  } else {
    priceField.readOnly = true;
    lineField.readOnly = true;
    typeField.readOnly = true;
    lineField.style.display = "";
    lineSelect.style.display = "none";
    typeField.style.display = "";
    typeSelect.style.display = "none";
    lineField.value = "";
    typeField.value = "";
    noteField.value = "";
    monthlyDates.style.display = "none";
  }
  resetUI(false);
}

// لۆجیکی خێرا و مۆدێرن بۆ پڕینت بە بێ تەئخیر بوون و پاشەکەوتکردن لە باکگراونددا
function handleAction() {
  const num = document.getElementById("carNumberInput").value;
  const price = document.getElementById("resPrice").value;
  const line =
    currentMode === "monthly"
      ? document.getElementById("resLineSelect").value
      : document.getElementById("resLine").value;
  const type =
    currentMode === "monthly"
      ? document.getElementById("resTypeSelect").value
      : document.getElementById("resType").value;
  const note = document.getElementById("resNote").value;
  const today = getTodayStr();

  if (!num || !price) return;
  if (currentMode === "monthly" && !document.getElementById("resLineSelect").value) {
    alert("تکایە هێڵ هەڵبژێرە");
    return;
  }
  if (currentMode === "monthly" && !document.getElementById("resTypeSelect").value) {
    alert("تکایە جۆر هەڵبژێرە");
    return;
  }
  if (currentMode === "monthly" && (!document.getElementById("resFromDate").value || !document.getElementById("resToDate").value)) {
    alert("تکایە بەروارەکان پڕبکەوە");
    return;
  }

  const btn = document.getElementById("saveBtn");
  if (btn.disabled) return;
  btn.disabled = true;

  // دیاریکردنی ژمارەی وەسڵی داهاتوو ڕاستەوخۆ لە ڕێگەی لۆکاڵەوە بۆ ئەوەی پرینت خێرا بێت
  let nextInvoiceNo = localMaxInvoiceNo + 1;
  localMaxInvoiceNo = nextInvoiceNo; 

  const dateNow = new Date();
  const dateStr =
    dateNow.toLocaleDateString("en-GB") +
    " " +
    dateNow.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const data = {
    invoiceNo: nextInvoiceNo,
    carNumber: num,
    price: parseInt(price),
    line: line,
    type: type,
    note: note,
    employee: currentUser,
    status: "active",
    date: dateStr,
    mode: currentMode,
  };
  
  if (currentMode === "monthly") {
    data.fromDate = document.getElementById("resFromDate").value.replace(/-/g, "/");
    data.toDate = document.getElementById("resToDate").value.replace(/-/g, "/");
  }

  // زیادکردنی وەسڵە نوێیەکە بۆ لیستی ناوخۆیی ئەمڕۆ بۆ ئەوەی ئەگەر دووبارە نوسرا یەکسەر ئاشکرای بکت
  todayInvoicesList.push(data);
  localStorage.setItem("todayInvoicesList", JSON.stringify(todayInvoicesList));

  // ئەپدێتکردنی ئامارەکان لەسەر شاشە بە خێرایی لۆکاڵی
  localCount++;
  localMoney += parseInt(price);
  localStorage.setItem("localMaxInvoiceNo", localMaxInvoiceNo);
  saveStatsToLocalStorage();
  updateStatsDisplay();

  // پڕکردنەوەی بەشەکانی پسوڵە بۆ چاپکردن
  document.getElementById("p-inv-no").innerText = "وەسڵی ژمارە: " + nextInvoiceNo;
  document.getElementById("p-num").innerText = num;
  document.getElementById("p-line-type").innerText = "هێڵی: " + line + " (" + type + ")";
  document.getElementById("p-price").innerText = price + " دینار";
  document.getElementById("p-user").innerText = "کارمەند: " + currentUser;
  document.getElementById("p-date").innerText = dateStr;
  
  const pNote = document.getElementById("p-note-txt");
  const pMonthly = document.getElementById("p-monthly-dates");
  
  if (currentMode === "monthly" && data.fromDate && data.toDate) {
    pMonthly.innerText = "لە: " + data.fromDate + "  بۆ: " + data.toDate;
    pMonthly.style.display = "block";
  } else {
    pMonthly.style.display = "none";
  }
  if (data.note) {
    pNote.innerText = "تێبینی: " + data.note;
    pNote.style.display = "block";
  } else {
    pNote.style.display = "none";
  }

  // لێرەدا ڕاستەوخۆ پرینت دەکرێت بێ هێچ دواکەوتنێک!
  window.print();
  resetUI(true);
  btn.disabled = false;

  // لۆجیکی خەزنکردنی باکگراوند (Async Background Save)
  if (navigator.onLine) {
    data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    db1.collection("Invoices")
      .doc(today)
      .collection("AllInvoices")
      .add(data)
      .catch((err) => {
        console.error("خەزنکردنی باکگراوند سەرکەوتوو نەبوو، دەخرێتە کوی ئۆفلاین:", err);
        let queue = JSON.parse(localStorage.getItem("offlineInvoiceQueue")) || [];
        queue.push({ today: today, data: data });
        localStorage.setItem("offlineInvoiceQueue", JSON.stringify(queue));
      });
  } else {
    let queue = JSON.parse(localStorage.getItem("offlineInvoiceQueue")) || [];
    queue.push({ today: today, data: data });
    localStorage.setItem("offlineInvoiceQueue", JSON.stringify(queue));
  }
}

async function syncOfflineQueue() {
  if (!navigator.onLine) return;
  let queue = JSON.parse(localStorage.getItem("offlineInvoiceQueue")) || [];
  if (queue.length === 0) return;

  console.log(`سیستەم گەڕایەوە سەر هێڵ. ${queue.length} وەسڵ ڕەوانە دەکرێت...`);

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      item.data.timestamp = firebase.firestore.FieldValue.serverTimestamp();
      await db1
        .collection("Invoices")
        .doc(item.today)
        .collection("AllInvoices")
        .add(item.data);
    } catch (err) {
      console.error("شکست لە هاودەمکردنی وەسڵ:", err);
    }
  }

  localStorage.removeItem("offlineInvoiceQueue");
  await loadDayCache();
}

function filterReportByNumber(val) {
  const rows = document.querySelectorAll("#report-body tr");
  rows.forEach((row) => {
    const numCell = row.cells[2];
    if (!numCell) return;
    row.style.display = String(numCell.textContent).includes(val.trim())
      ? ""
      : "none";
  });
}

async function openMyReport() {
  const tbody = document.getElementById("report-body");
  tbody.innerHTML = "بار دەبێت...";
  document.getElementById("reportSearchInput").value = "";
  document.getElementById("report-modal").style.display = "flex";
  const today = getTodayStr();

  // پەرەپێدانی بەشی ڕاپۆرت بۆ ئەوەی لە کاتی ئۆفلاینیشدا کاربکات لە سەر داتای لۆکاڵ
  if (!navigator.onLine) {
    if (todayInvoicesList.length > 0) {
      renderReportRows(todayInvoicesList.filter(d => d.employee === currentUser));
    } else {
      tbody.innerHTML = "<tr><td colspan='8'>هێڵ نییە و هیچ داتایەک لە کاشدا پاشەکەوت نەکراوە!</td></tr>";
    }
    return;
  }

  try {
    const snap = await db1
      .collection("Invoices")
      .doc(today)
      .collection("AllInvoices")
      .where("employee", "==", currentUser)
      .get();
    let docs = [];
    snap.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
    
    renderReportRows(docs);
  } catch (e) {
    console.error(e);
    // ئەگەر فایەربەیس کێشەی دروستکردنی ئیندێکسی هەبوو، لۆکاڵی پیشانی دەدات بۆ ئەوەی ڕاپۆرتەکە سپی نەبێت
    if (todayInvoicesList.length > 0) {
      renderReportRows(todayInvoicesList.filter(d => d.employee === currentUser));
    } else {
      tbody.innerHTML = "<tr><td colspan='8'>هەڵە لە بارکردنی ڕاپۆرت لە سێرڤەرەوە.</td></tr>";
    }
  }
}

function renderReportRows(docsList) {
  const tbody = document.getElementById("report-body");
  docsList.sort((a, b) => (parseInt(b.invoiceNo) || 0) - (parseInt(a.invoiceNo) || 0));
  
  let rows = "";
  docsList.forEach((d) => {
    const isCanceled = d.status === "canceled";
    rows += `<tr class="${isCanceled ? "canceled-row" : ""}">
              <td>${d.invoiceNo}</td>
              <td>${d.date}</td>
              <td>${d.carNumber}</td>
              <td>${d.line}</td>
              <td>${d.type || "-"}</td>
              <td>${parseInt(d.price).toLocaleString()}</td>
              <td>${d.note || "-"}</td>
              <td>${isCanceled ? "-" : `<button onclick="cancelInv('${d.id || ''}',${parseInt(d.price)}, ${d.invoiceNo})" style="background:red; color:white; padding:3px 7px; border-radius:4px;">سڕینەوە</button>`}</td>
          </tr>`;
  });
  tbody.innerHTML = rows ? rows : "<tr><td colspan='8'>هیچ وەسڵێک نەدۆزرایەوە.</td></tr>";
}

function updateStats() {
  updateStatsDisplay();
}

function resetUI(clearAll) {
  document.getElementById("carNumberInput").value = "";
  selectedCarProvince = "";
  updateProvinceButtonsVisibility("");
  const warningDiv = document.getElementById("duplicateCarWarning");
  if (warningDiv) warningDiv.style.display = "none";

  if (clearAll) {
    document.getElementById("resPrice").value = "";
    if (currentMode === "normal") {
      document.getElementById("resNote").value = "";
      document.getElementById("resType").value = "";
      document.getElementById("resLine").value = "";
    } else if (currentMode === "parking") {
      document.getElementById("resNote").value = "";
    } else if (currentMode === "fine") {
      document.getElementById("resNote").value = "غەرامە";
      document.getElementById("resLine").value = "";
    } else if (currentMode === "monthly") {
      document.getElementById("resNote").value = "مانگانەی بۆ کراوە";
      document.getElementById("resLineSelect").value = "";
      document.getElementById("resTypeSelect").value = "";
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      document.getElementById("resFromDate").value = today.toLocaleDateString("en-CA");
      document.getElementById("resToDate").value = nextMonth.toLocaleDateString("en-CA");
    }
  }
  document.getElementById("btnHalf").style.display = "none";
  document.getElementById("carMatchList").style.display = "none";
  document.getElementById("carNumberInput").focus();
}

async function cancelInv(id, price, invoiceNo) {
  if (!navigator.onLine) {
    alert("ناتوانیت وەسڵ بسڕیتەوە لە کاتی ئۆفلاین بووندا!");
    return;
  }
  if (!id) {
    alert("ئەم وەسڵە هێشتا بە تەواوی لە سێرڤەر خەزن نەبووە، کەمێکی تر تاقی بکەرەوە.");
    return;
  }
  const reason = prompt("هۆکاری سڕینەوە:");
  if (!reason) return;
  const today = getTodayStr();
  try {
    await db1
      .collection("Invoices")
      .doc(today)
      .collection("AllInvoices")
      .doc(id)
      .update({
        status: "canceled",
        deleteReason: reason,
      });
    
    // نوێکردنەوەی دۆخی وەسڵەکە لە ناو لیستی لۆکاڵیشدا
    todayInvoicesList = todayInvoicesList.map(inv => inv.invoiceNo === invoiceNo ? { ...inv, status: "canceled" } : inv);
    localStorage.setItem("todayInvoicesList", JSON.stringify(todayInvoicesList));

    localCount--;
    localMoney -= price;
    saveStatsToLocalStorage();
    updateStatsDisplay();
    openMyReport();
  } catch (e) {
    alert("هەڵە لە سڕینەوە");
  }
}

function makeHalfPrice() {
  let pInput = document.getElementById("resPrice");
  let noteInput = document.getElementById("resNote");
  let currentPrice = parseInt(pInput.value);
  if (currentPrice === 6500) {
    pInput.value = 3000;
  } else {
    pInput.value = Math.floor(currentPrice / 2);
  }
  noteInput.value = noteInput.value ? noteInput.value + " - نیوە" : "نیوە";
  document.getElementById("btnHalf").style.display = "none";
}

function closeReport() {
  document.getElementById("report-modal").style.display = "none";
  document.getElementById("carNumberInput").focus();
}

document.addEventListener("click", function (e) {
  const tag = e.target.tagName;
  if (
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    tag === "TEXTAREA"
  )
    return;
  if (document.getElementById("report-modal").style.display === "flex") return;
  if (document.getElementById("login-overlay").style.display !== "none") return;
  document.getElementById("carNumberInput").focus();
});

function closeModal() {
  document.getElementById("myModal").style.display = "none";
  document.getElementById("reportFrame").src = "";
}
