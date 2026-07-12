const config1 = {
  apiKey: "AIzaSyCuUstd-6d0E-EbmQipv2mWk-bA55ajpQ0",
  authDomain: "car-system-4594d.firebaseapp.com",
  projectId: "car-system-4594d",
  storageBucket: "car-system-4594d.firebasestorage.app",
  messagingSenderId: "719030469585",
  appId: "1:719030469585:web:7a23645b9e684b727dd6f0",
};

// چالاککردنی داتابەیسی یەکەم
const app1 = firebase.initializeApp(config1, "a1");
const db1 = app1.firestore();

// چالاککردنی تایبەتمەندی کارکردن بەبێ ئینتەرنێت (Offline Persistence) بۆ کارکردنی تەواوی ئۆفلاین
db1.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log("Persistence failed: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      console.log("Persistence is not supported by this browser.");
    }
  });

let allCars = [];
let currentMode = "normal";
let currentUser = localStorage.getItem("terminalUser") || "";
let selectedCarProvince = "";

// --- چاودێری ئۆتۆماتیکی دۆخی ئینتەرنێت (سەربەخۆ لە دوگمەی پرینت) ---
let isOnline = navigator.onLine;

function updateNetworkIndicator() {
  const dot = document.getElementById("netStatusDot");
  if (!dot) return;
  if (isOnline) {
    dot.style.background = "#27ae60";
    dot.title = "ئینتەرنێت هەیە";
  } else {
    dot.style.background = "#e74c3c";
    dot.title =
      "ئینتەرنێت نییە - وەسڵەکان لۆکاڵی خەزن دەکرێن و خۆکارانه دواتر دەنێردرێن";
  }
}

function setDuplicateWarning(show) {
  const warn = document.getElementById("duplicateWarning");
  if (!warn) return;
  warn.style.display = show ? "block" : "none";
}

window.addEventListener("online", () => {
  isOnline = true;
  updateNetworkIndicator();
});
window.addEventListener("offline", () => {
  isOnline = false;
  updateNetworkIndicator();
});

// چاوەڕوانبوون بۆ دڵنیابوون لە گەیشتنی وەسڵێک بۆ سێرڤەری ڕاستەقینەی Firebase
function confirmServerSync(docRef, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        unsubscribe();
      } catch (e) {}
      resolve(result);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const unsubscribe = docRef.onSnapshot(
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.hasPendingWrites) finish(true);
      },
      () => finish(false),
    );
  });
}

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

// --- Local day-cache (avoids repeated Firestore reads) ---
let localMaxInvoiceNo = 0;
let localCount = 0;
let localMoney = 0;
let cacheDay = null; // date string the cache belongs to

const getTodayStr = () => new Date().toLocaleDateString("en-CA");

// گۆڕینی کاتی Firestore بۆ فۆرماتی بەرواری ئاسایی YYYY-MM-DD بۆ بەراوردکاری
function formatFirestoreTimestamp(timestamp) {
  if (!timestamp) return "";
  let date;
  if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  return date.toLocaleDateString("en-CA");
}

// لۆدکردنی کاش و داتاکانی ڕۆژ
async function loadDayCache() {
  const today = getTodayStr();
  if (cacheDay === today) return;
  try {
    const snap = await db1
      .collection("Invoices")
      .doc(today)
      .collection("AllInvoices")
      .get();
    let maxNo = 0,
      cnt = 0,
      money = 0;
    snap.forEach((doc) => {
      const d = doc.data();
      const no = parseInt(d.invoiceNo);
      if (!isNaN(no) && no > maxNo) maxNo = no;
      if (d.employee === currentUser && d.status === "active") {
        money += parseInt(d.price || 0);
        cnt++;
      }
    });
    localMaxInvoiceNo = maxNo;
    localCount = cnt;
    localMoney = money;
    cacheDay = today;
  } catch (e) {
    console.log("تێبینی: کارکردن لە دۆخی ئۆفلایین یان کێشەی هێڵ", e.message);
  }
}

function updateStatsDisplay() {
  document.getElementById("totalCount").innerText = localCount;
  document.getElementById("totalMoney").innerText =
    localMoney.toLocaleString() + " د.ع";
}

window.onload = async () => {
  try {
    const empSnap = await db1.collection("Employees").get();
    const select = document.getElementById("userSelect");
    select.innerHTML = '<option value="">ناو هەڵبژێرە...</option>';
    empSnap.forEach((doc) => {
      if (doc.data().role === "staff" || doc.data().name === "admin") {
        select.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`;
      }
    });
  } catch(e) {
    console.log("خوێندنەوەی کارمەندان لە کاشەوە ئەنجامدرا");
  }

  try {
    const carSnap = await db1.collection("Cars").get();
    allCars = carSnap.docs.map((doc) => doc.data());
  } catch(e) {
    console.log("خوێندنەوەی ئۆتۆمبێلەکان لە کاشەوە ئەنجامدرا");
  }

  if (currentUser) {
    showMainApp();
  }
};

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
    successLogin("admin");
    return;
  }
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
  } catch(e) {
    if (currentUser && currentUser === name) {
      successLogin(name);
    } else {
      alert("پەیوەندی ئینتەرنێت نییە و ناتوانرێت کارمەندی نوێ پشتڕاست بکرێتەوە!");
    }
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
  document.getElementById("employeeNameText").innerText =
    "بەکارهێنەر: " + currentUser;
  updateNetworkIndicator();
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

function checkCarColorStatus(num, carMatch) {
  const todayStr = getTodayStr();
  if (carMatch && carMatch.time) {
    const carCreatedDay = formatFirestoreTimestamp(carMatch.time);
    if (carCreatedDay === todayStr) {
      return "yellow";
    }
  }
  return "none";
}

async function isInvoiceRepeatedToday(num) {
  const today = getTodayStr();
  try {
    const snap = await db1
      .collection("Invoices")
      .doc(today)
      .collection("AllInvoices")
      .where("carNumber", "==", num)
      .where("status", "==", "active")
      .get();
    return !snap.empty;
  } catch (e) {
    return false;
  }
}

async function searchCarLocally(num) {
  const listDiv = document.getElementById("carMatchList");
  listDiv.innerHTML = "";
  listDiv.style.display = "none";
  
  const inputField = document.getElementById("carNumberInput");
  inputField.style.backgroundColor = "";
  inputField.style.color = "";
  setDuplicateWarning(false);

  updateProvinceButtonsVisibility(num);
  if (currentMode === "parking" || !num) {
    clearCarFields();
    return;
  }
  
  const matches = allCars.filter((c) => String(c.number) === String(num));
  let matchedCar = null;

  if (matches.length === 1) {
    matchedCar = matches[0];
    setCarData(matchedCar);
  } else if (matches.length > 1) {
    listDiv.style.display = "block";
    matches.forEach((m) => {
      const div = document.createElement("div");
      div.className = "match-item";
      div.innerHTML = `<span>هێڵی: ${m.line} (${m.type})</span> <span>${m.price} د.ع</span>`;
      div.onclick = async () => {
        setCarData(m);
        listDiv.style.display = "none";
        await applyColorLogic(num, m);
      };
      listDiv.appendChild(div);
    });
    return;
  } else {
    clearCarFields();
  }

  await applyColorLogic(num, matchedCar);
}

async function applyColorLogic(num, matchedCar) {
  const inputField = document.getElementById("carNumberInput");
  const repeated = await isInvoiceRepeatedToday(num);

  if (repeated) {
    inputField.style.backgroundColor = "#3498db";
    inputField.style.color = "#fff";
    inputField.setAttribute("data-color-tag", "blue");
    setDuplicateWarning(true);
  } else {
    inputField.style.backgroundColor = "";
    inputField.style.color = "";
    inputField.removeAttribute("data-color-tag");
    setDuplicateWarning(false);
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

async function handleAction() {
  const numInput = document.getElementById("carNumberInput");
  const num = numInput.value;
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

  const colorTag = numInput.getAttribute("data-color-tag") || "none";

  if (!num || !price) return;
  if (
    currentMode === "monthly" &&
    !document.getElementById("resLineSelect").value
  ) {
    alert("تکایە هێڵ هەڵبژێرە");
    return;
  }
  if (
    currentMode === "monthly" &&
    !document.getElementById("resTypeSelect").value
  ) {
    alert("تکایە جۆر هەڵبژێرە");
    return;
  }
  if (
    currentMode === "monthly" &&
    (!document.getElementById("resFromDate").value ||
      !document.getElementById("resToDate").value)
  ) {
    alert("تکایە بەروارەکان پڕبکەوە");
    return;
  }

  const btn = document.getElementById("saveBtn");
  if (btn.disabled) return;
  btn.disabled = true;

  try {
    await loadDayCache();
    const subColRef = db1
      .collection("Invoices")
      .doc(today)
      .collection("AllInvoices");
    let nextInvoiceNo = localMaxInvoiceNo + 1;

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
      colorTag: colorTag,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (currentMode === "monthly") {
      data.fromDate = document
        .getElementById("resFromDate")
        .value.replace(/-/g, "/");
      data.toDate = document
        .getElementById("resToDate")
        .value.replace(/-/g, "/");
    }

    // پاشەکەوتکردن بە شێوازی ئۆفلایین بەبێ وەستاندنی پرۆسەکە بۆ وەڵامی سێرڤەر
    const newDocRef = subColRef.doc();
    newDocRef.set(data).catch((err) => {
      console.log("خەزنکردنی ناوخۆیی (لۆکاڵ): ", err.message);
    });

    // ئامادەکردنی ڕووکاری پسووڵە بۆ پرینت
    document.getElementById("p-inv-no").innerText =
      "وەسڵی ژمارە: " + nextInvoiceNo;
    document.getElementById("p-num").innerText = num;
    document.getElementById("p-line-type").innerText =
      "هێڵی: " + line + " (" + type + ")";
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

    // فەرمانی پرینت بە پێی دۆخی ئینتەرنێت:
    // ئەگەر ئینتەرنێت هەبێت ۱ جار پرینت دەکات، ئەگەر نەبێت ٢ جار بەسەر یەکەوە پرینت دەکات
    if (isOnline) {
      window.print();
    } else {
      window.print();
      window.print();
    }

    // نوێکردنەوەی ئامارە لۆکاڵییەکان
    localMaxInvoiceNo = nextInvoiceNo;
    localCount++;
    localMoney += parseInt(price);
    updateStatsDisplay();

    resetUI(true);
  } catch (e) {
    alert("هەڵە ڕوویدا لە خەزنکردن: " + e.message);
  } finally {
    btn.disabled = false;
  }
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
  try {
    const snap = await db1
      .collection("Invoices")
      .doc(today)
      .collection("AllInvoices")
      .where("employee", "==", currentUser)
      .get();
    let docs = [];
    snap.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
    
    docs.sort(
      (a, b) => (parseInt(b.invoiceNo) || 0) - (parseInt(a.invoiceNo) || 0),
    );
    
    let rows = "";
    docs.forEach((d) => {
      const isCanceled = d.status === "canceled";
      
      let rowColorClass = "";
      if (!isCanceled) {
        if (d.colorTag === "yellow") rowColorClass = "row-yellow";
        else if (d.colorTag === "blue") rowColorClass = "row-blue";
      } else {
        rowColorClass = "canceled-row";
      }

      rows += `<tr class="${rowColorClass}">
                <td>${d.invoiceNo}</td>
                <td>${d.date}</td>
                <td>${d.carNumber}</td>
                <td>${d.line}</td>
                <td>${d.type || "-"}</td>
                <td>${parseInt(d.price).toLocaleString()}</td>
                <td>${d.note || "-"}</td>
                <td>${isCanceled ? "-" : `<button onclick="cancelInv('${d.id}',${parseInt(d.price)})" style="background:red; color:white; padding:3px 7px; border-radius:4px;">سڕینەوە</button>`}</td>
            </tr>`;
    });
    tbody.innerHTML = rows;
  } catch (e) {
    tbody.innerHTML = "هەڵە لە بارکردن";
  }
}

function updateStats() {
  updateStatsDisplay();
}

function resetUI(clearAll) {
  const numInput = document.getElementById("carNumberInput");
  numInput.value = "";
  numInput.style.backgroundColor = "";
  numInput.style.color = "";
  numInput.removeAttribute("data-color-tag");
  setDuplicateWarning(false);

  selectedCarProvince = "";
  updateProvinceButtonsVisibility("");
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
      document.getElementById("resFromDate").value =
        today.toLocaleDateString("en-CA");
      document.getElementById("resToDate").value =
        nextMonth.toLocaleDateString("en-CA");
    }
  }
  document.getElementById("btnHalf").style.display = "none";
  document.getElementById("carMatchList").style.display = "none";
  numInput.focus();
}

async function cancelInv(id, price) {
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
    
    localCount--;
    localMoney -= price;
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
