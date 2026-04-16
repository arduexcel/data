const config1 = { apiKey: "AIzaSyCuUstd-6d0E-EbmQipv2mWk-bA55ajpQ0", authDomain: "car-system-4594d.firebaseapp.com", projectId: "car-system-4594d", storageBucket: "car-system-4594d.firebasestorage.app", messagingSenderId: "719030469585", appId: "1:719030469585:web:7a23645b9e684b727dd6f0" };
const config2 = { apiKey: "AIzaSyAMI84_IuKUZVqc8ImMW7eahru20cTkjFM", authDomain: "sysam-k.firebaseapp.com", projectId: "sysam-k", storageBucket: "sysam-k.firebasestorage.app", messagingSenderId: "905972435434", appId: "1:905972435434:web:2501e11240523f8368ca93" };

const app1 = firebase.initializeApp(config1, "a1");
const app2 = firebase.initializeApp(config2, "a2");
const db1 = app1.firestore();
const db2 = app2.firestore();

let allCars = [];
let currentMode = 'normal';
let currentUser = localStorage.getItem("terminalUser") || "";
let localMaxInvoiceNo = 0;
let localCount = 0;
let localMoney = 0;
let cacheDay = null;

const getTodayStr = () => new Date().toLocaleDateString('en-CA');

async function loadDayCache() {
    const today = getTodayStr();
    if (cacheDay === today) return;
    const snap = await db1.collection("Invoices").doc(today).collection("AllInvoices").get();
    let maxNo = 0, cnt = 0, money = 0;
    snap.forEach(doc => {
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
}

function updateStatsDisplay() {
    document.getElementById('totalCount').innerText = localCount;
    document.getElementById('totalMoney').innerText = localMoney.toLocaleString() + " د.ع";
}

window.onload = async () => {
    const empSnap = await db1.collection("Employees").get();
    const select = document.getElementById('userSelect');
    select.innerHTML = '<option value="">ناو هەڵبژێرە...</option>';
    empSnap.forEach(doc => {
        if(doc.data().role === 'staff' || doc.data().name === 'admin') {
            select.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`;
        }
    });
    const carSnap = await db1.collection("Cars").get();
    allCars = carSnap.docs.map(doc => doc.data());
    if(currentUser) { showMainApp(); }
};

document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const num = document.getElementById('carNumberInput').value;
        const price = document.getElementById('resPrice').value;
        if (num && price && document.getElementById('main-content').style.display !== 'none') {
            handleAction();
        }
    }
});

async function login() {
    const name = document.getElementById('userSelect').value;
    const pass = document.getElementById('userPass').value;
    if(!name || !pass) return alert("ناو و پاسۆرد بنووسە");
    if(name === "admin" && pass === "0055") { successLogin("admin"); return; }
    const snap = await db1.collection("Employees").where("name", "==", name).where("password", "==", pass).get();
    if(!snap.empty) { successLogin(name); } else { alert("پاسۆردەکە هەڵەیە!"); }
}

function successLogin(name) {
    currentUser = name;
    localStorage.setItem("terminalUser", name);
    showMainApp();
}

async function showMainApp() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('displayEmployeeName').innerText = "بەکارهێنەر: " + currentUser;
    await loadDayCache();
    updateStatsDisplay();
    document.getElementById('carNumberInput').focus();
}

function logout() {
    localStorage.removeItem("terminalUser");
    currentUser = "";
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    location.reload();
}

function searchCarLocally(num) {
    const listDiv = document.getElementById('carMatchList');
    listDiv.innerHTML = "";
    listDiv.style.display = "none";
    if(currentMode === 'parking' || !num) { clearCarFields(); return; }
    const matches = allCars.filter(c => String(c.number) === String(num));
    if(matches.length === 1) {
        setCarData(matches[0]);
    } else if (matches.length > 1) {
        listDiv.style.display = "block";
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'match-item';
            div.innerHTML = `<span>هێڵی: ${m.line} (${m.type})</span> <span>${m.price} د.ع</span>`;
            div.onclick = () => { setCarData(m); listDiv.style.display = "none"; };
            listDiv.appendChild(div);
        });
    } else {
        clearCarFields();
    }
}

function clearCarFields() {
    document.getElementById('resLine').value = "";
    if(currentMode === 'normal') {
        document.getElementById('resType').value = "";
        document.getElementById('resPrice').value = "";
        document.getElementById('btnHalf').style.display = "none";
    }
}

function setCarData(match) {
    document.getElementById('resLine').value = match.line;
    document.getElementById('resType').value = match.type;
    if(currentMode === 'normal') {
        document.getElementById('resPrice').value = match.price;
        document.getElementById('btnHalf').style.display = (match.type === "پاس") ? "block" : "none";
    }
}

function toggleMode(mode) {
    if(currentMode === mode) {
        currentMode = 'normal';
        document.getElementById('parkingModeBtn').classList.remove('mode-active');
        document.getElementById('fineModeBtn').classList.remove('mode-active');
    } else {
        currentMode = mode;
        document.getElementById('parkingModeBtn').classList.toggle('mode-active', mode === 'parking');
        document.getElementById('fineModeBtn').classList.toggle('mode-active', mode === 'fine');
    }
    const priceField = document.getElementById('resPrice');
    const lineField = document.getElementById('resLine');
    const typeField = document.getElementById('resType');
    const noteField = document.getElementById('resNote');
    if(currentMode === 'parking') {
        priceField.readOnly = false;
        lineField.value = "پارکینگ";
        typeField.value = "پارکینگ";
        noteField.value = "";
    } else if(currentMode === 'fine') {
        priceField.readOnly = false;
        lineField.value = "";
        typeField.value = "غەرامە";
        noteField.value = "غەرامە";
    } else {
        priceField.readOnly = true;
        lineField.value = "";
        typeField.value = "";
        noteField.value = "";
    }
    resetUI(false);
}

async function handleAction() {
    const num = document.getElementById('carNumberInput').value;
    const price = document.getElementById('resPrice').value;
    const line = document.getElementById('resLine').value;
    const type = document.getElementById('resType').value;
    const note = document.getElementById('resNote').value;
    const today = getTodayStr();
document.body.classList.add('printing-invoice');
    window.print();
    // دوای پڕینت کردن:
    document.body.classList.remove('printing-invoice');
    if(!num || !price) return;
    const btn = document.getElementById('saveBtn');
    if(btn.disabled) return;
    btn.disabled = true;
document.body.classList.add('printing-report');
    window.print();
    // دوای پڕینت کردن:
    document.body.classList.remove('printing-report');
}
    try {
        await loadDayCache();
        const subColRef = db1.collection("Invoices").doc(today).collection("AllInvoices");
        let nextInvoiceNo = localMaxInvoiceNo + 1;
        const dateNow = new Date();
        const dateStr = dateNow.toLocaleDateString('en-GB') + " " + dateNow.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'});

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
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        document.getElementById('p-inv-no').innerText = "وەسڵی ژمارە: " + nextInvoiceNo;
        document.getElementById('p-num').innerText = num;
        document.getElementById('p-line-type').innerText = "هێڵی: " + line + " (" + type + ")";
        document.getElementById('p-price').innerText = price + " دینار";
        document.getElementById('p-user').innerText = "کارمەند: " + currentUser;
        document.getElementById('p-date').innerText = dateStr;
        const pNote = document.getElementById('p-note-txt');
        if(data.note) { pNote.innerText = "تێبینی: " + data.note; pNote.style.display = "block"; } else { pNote.style.display = "none"; }

        window.print();

        const newDocRef = subColRef.doc();
        await Promise.all([
            newDocRef.set(data),
            db2.collection("Invoices").doc(today).collection("AllInvoices").doc(newDocRef.id).set(data)
        ]);

        localMaxInvoiceNo = nextInvoiceNo;
        localCount++;
        localMoney += parseInt(price);
        updateStatsDisplay();
        resetUI(true);
    } catch (e) { alert("هەڵە: " + e.message); } finally { btn.disabled = false; }
}

function filterReportByNumber(val) {
    const rows = document.querySelectorAll('#report-body tr');
    rows.forEach(row => {
        const numCell = row.cells[2];
        if (!numCell) return;
        row.style.display = String(numCell.textContent).includes(val.trim()) ? '' : 'none';
    });
}

async function openMyReport() {
    const tbody = document.getElementById('report-body');
    tbody.innerHTML = "بار دەبێت...";
    document.getElementById('reportSearchInput').value = '';
    document.getElementById('report-modal').style.display = 'flex';
    const today = getTodayStr();
    try {
        const snap = await db1.collection("Invoices").doc(today).collection("AllInvoices").where("employee", "==", currentUser).get();
        let docs = [];
        snap.forEach(doc => docs.push({id: doc.id, ...doc.data()}));
        docs.sort((a, b) => (parseInt(b.invoiceNo) || 0) - (parseInt(a.invoiceNo) || 0));
        let rows = '';
        docs.forEach(d => {
            const isCanceled = d.status === "canceled";
            rows += `<tr class="${isCanceled ? 'canceled-row' : ''}">
                <td>${d.invoiceNo}</td><td>${d.date}</td><td>${d.carNumber}</td><td>${d.line}</td><td>${d.type || '-'}</td><td>${parseInt(d.price).toLocaleString()}</td><td>${d.note || '-'}</td>
                <td>${isCanceled ? '-' : `<button onclick="cancelInv('${d.id}',${parseInt(d.price)})" style="background:red; color:white; padding:3px 7px; border-radius:4px;">سڕینەوە</button>`}</td>
            </tr>`;
        });
        tbody.innerHTML = rows;
    } catch (e) { tbody.innerHTML = "هەڵە لە بارکردن"; }
}

function resetUI(clearAll) {
    document.getElementById('carNumberInput').value = "";
    if(clearAll) {
        document.getElementById('resPrice').value = "";
        if(currentMode === 'normal') {
            document.getElementById('resNote').value = "";
            document.getElementById('resType').value = "";
            document.getElementById('resLine').value = "";
        } else if (currentMode === 'parking') {
            document.getElementById('resNote').value = "";
        } else if (currentMode === 'fine') {
            document.getElementById('resNote').value = "غەرامە";
            document.getElementById('resLine').value = "";
        }
    }
    document.getElementById('btnHalf').style.display = "none";
    document.getElementById('carMatchList').style.display = "none";
    document.getElementById('carNumberInput').focus();
}

async function cancelInv(id, price) {
    const reason = prompt("هۆکاری سڕینەوە:");
    if(!reason) return;
    const today = getTodayStr();
    try {
        await db1.collection("Invoices").doc(today).collection("AllInvoices").doc(id).update({status: "canceled", deleteReason: reason});
        await db2.collection("Invoices").doc(today).collection("AllInvoices").doc(id).delete();
        localCount--;
        localMoney -= price;
        updateStatsDisplay();
        openMyReport();
    } catch (e) { alert("هەڵە لە سڕینەوە"); }
}

function makeHalfPrice() {
    let pInput = document.getElementById('resPrice');
    let noteInput = document.getElementById('resNote');
    let currentPrice = parseInt(pInput.value);
    if (currentPrice === 6500) { pInput.value = 3000; } else { pInput.value = Math.floor(currentPrice / 2); }
    noteInput.value = (noteInput.value ? noteInput.value + " - نیوە" : "نیوە");
    document.getElementById('btnHalf').style.display = "none";
}

function closeReport() { document.getElementById('report-modal').style.display = 'none'; document.getElementById('carNumberInput').focus(); }

// فانکشنی نوێ بۆ دروستکردنی ڕاپۆرتی کۆتایی بەپێی وێنەکە
async function printShiftReport() {
    const today = getTodayStr();
    const btn = document.getElementById('shiftReportBtn');
    btn.innerText = "باردەبێت...";
    
    try {
        const snap = await db1.collection("Invoices").doc(today).collection("AllInvoices")
                            .where("employee", "==", currentUser)
                            .where("status", "==", "active")
                            .get();

        if (snap.empty) {
            alert("هیچ وەسڵێکی چالاکت نییە");
            btn.innerText = "ڕاپۆرتی کۆتایی";
            return;
        }

        let minInv = Infinity;
        let maxInv = -Infinity;
        let totalP = 0;
        let count = 0;

        snap.forEach(doc => {
            const d = doc.data();
            const no = parseInt(d.invoiceNo);
            if (!isNaN(no)) {
                if (no < minInv) minInv = no;
                if (no > maxInv) maxInv = no;
            }
            totalP += parseInt(d.price || 0);
            count++;
        });

        const dateNow = new Date();
        const dateStr = dateNow.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}) + " " + dateNow.toLocaleDateString('en-GB');

        document.getElementById('sr-user').innerText = currentUser;
        document.getElementById('sr-date').innerText = dateStr;
        document.getElementById('sr-range').innerHTML = `<b>لە وەسڵی:</b> ${minInv} <b>تا وەسڵی:</b> ${maxInv}`;
        document.getElementById('sr-count').innerText = count;
        document.getElementById('sr-total').innerText = totalP.toLocaleString() + " د.ع";

        window.print();

    } catch (e) {
        alert("هەڵە: " + e.message);
    } finally {
        btn.innerText = "ڕاپۆرتی کۆتایی";
    }
}

document.addEventListener('click', function(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
    if (document.getElementById('report-modal').style.display === 'flex') return;
    if (document.getElementById('login-overlay').style.display !== 'none') return;
    document.getElementById('carNumberInput').focus();
});
