/* ==========================================================
   STORE BERSAMA - Section Viber (tanpa backend)
   Semua halaman (Public & Leader) membaca/menulis data lewat file ini,
   disimpan di localStorage browser. Primary key pekerjaan = Prod. Order.
   Saat pakai backend nanti, cukup ganti isi fungsi di file ini dengan API call.
   ========================================================== */
(function (w) {
    const KEYS = {
        jobs: 'sectionViberJobsV2',
        log: 'sectionViberStatusLogV2',
        emps: 'sectionViberEmployeeList',
        map: 'sectionViberEmployees',
        picks: 'sectionViberPicklists'
    };

    const BAGIAN = ['Rangka', 'Cetak', 'Cutting', 'Pembenahan', 'Setting & Croping', 'Finishing', 'Master', 'Moulding'];
    const MASALAH = ['Man', 'Material', 'Method', 'Machine', 'Environment'];
    const STATUSES = ['Planning', 'On progress', 'Done', 'Pending', 'Cancel'];

    const DEFAULT_EMPLOYEES = [
        { nik: 'WN0001', name: 'Rangga Irawan', bagian: 'Cetak' },
        { nik: 'WN0003', name: 'Dian Satrio Ardi Wibowo', bagian: 'Rangka' },
        { nik: 'WN0007', name: 'Irfan Muhamad', bagian: 'Finishing' },
        { nik: 'WN0008', name: 'Bayu', bagian: 'Moulding' },
        { nik: 'EMP003', name: 'Budi Santoso', bagian: 'Cutting' },
        { nik: 'EMP011', name: 'Maryono', bagian: 'Pembenahan' }
    ];

    /* ---------- util ---------- */
    const pad = n => String(n).padStart(2, '0');
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const fmtDate = iso => (iso || '').split('-').reverse().join('/');
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function read(key, fallback) {
        try {
            const v = JSON.parse(localStorage.getItem(key) || 'null');
            return v == null ? fallback : v;
        } catch (e) { return fallback; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }

    /* ---------- data awal (contoh) ---------- */
    function seed() {
        const jobs = [
            { prod: '400155471', date: '2026-09-30', material: '181020501', work: 'Cek dashboard R25', so: 'BB30051-26', qty: '1 pc',
              team: [{ id: 'WN0003', name: 'Dian Satrio Ardi Wibowo' }, { id: 'WN0001', name: 'Rangga Irawan' }], progress: 60, status: 'On progress' },
            { prod: '400155472', date: '2026-09-30', material: '181020502', work: 'Cuci belakang R25 MHD', so: 'BB30052-26', qty: '2 pcs',
              team: [{ id: 'WN0001', name: 'Rangga Irawan' }], progress: 100, status: 'Done', doneDate: '2026-09-30' },
            { prod: '400155473', date: '2026-09-30', material: '181020503', work: 'Setting roll depan D5', so: 'BB30053-26', qty: '1 pc',
              team: [], progress: 0, status: 'Planning' },
            { prod: '400155474', date: '2026-09-30', material: '181020504', work: 'Bumper belakang R25', so: 'BB30054-26', qty: '1 pc',
              team: [{ id: 'WN0007', name: 'Irfan Muhamad' }], progress: 25, status: 'Pending', issue: 'Material', holdTime: '13:20',
              reason: 'Menunggu material dari gudang. Material belum tersedia sehingga pekerjaan belum dapat dilanjutkan.' },
            { prod: '400155475', date: '2026-09-30', material: '181020505', work: 'Extension dan bande R25', so: 'BB30055-26', qty: '2 unit',
              team: [{ id: 'EMP011', name: 'Maryono' }, { id: 'EMP003', name: 'Budi Santoso' }], progress: 45, status: 'On progress' },
            { prod: '400155476', date: '2026-09-30', material: '181020506', work: 'Setting coil depan Ground', so: 'BB30056-26', qty: '1 unit',
              team: [{ id: 'WN0007', name: 'Irfan Muhamad' }], progress: 30, status: 'Cancel', issue: 'Method', holdTime: '14:20',
              reason: 'Pekerjaan dibatalkan karena terdapat perubahan prioritas produksi dari leader.' },
            { prod: '400155477', date: '2026-10-01', material: '181020507', work: 'Pemeriksaan unit R25', so: 'BB30071-26', qty: '1 unit',
              team: [{ id: 'WN0003', name: 'Dian Satrio Ardi Wibowo' }], progress: 60, status: 'On progress' },
            { prod: '400155478', date: '2026-10-01', material: '181020508', work: 'Finishing panel samping', so: 'BB30072-26', qty: '2 pcs',
              team: [{ id: 'WN0001', name: 'Rangga Irawan' }], progress: 100, status: 'Done', doneDate: '2026-10-01' }
        ];

        const L = (job, date, time, from, to, extra) => Object.assign({
            ts: Date.parse(`${date}T${time}:00`), date, time, prod: job.prod, material: job.material, work: job.work, so: job.so,
            from, to, issue: '', reason: '', progress: job.progress, by: 'Karyawan', role: 'Public'
        }, extra || {});
        const j = p => jobs.find(x => x.prod === p);

        const log = [
            L(j('400155471'), '2026-09-30', '08:10', 'Planning', 'On progress', { progress: 40 }),
            L(j('400155472'), '2026-09-30', '08:40', 'Planning', 'On progress', { progress: 50 }),
            L(j('400155472'), '2026-09-30', '11:30', 'On progress', 'Done', { progress: 100 }),
            L(j('400155474'), '2026-09-30', '13:20', 'On progress', 'Pending', { issue: 'Material', reason: j('400155474').reason }),
            L(j('400155475'), '2026-09-30', '09:15', 'Planning', 'On progress', { progress: 20 }),
            L(j('400155476'), '2026-09-30', '14:20', 'On progress', 'Cancel', { issue: 'Method', reason: j('400155476').reason }),
            L(j('400155477'), '2026-10-01', '08:05', 'Planning', 'On progress', { progress: 60 }),
            L(j('400155478'), '2026-10-01', '09:00', 'Planning', 'On progress', { progress: 70 }),
            L(j('400155478'), '2026-10-01', '10:45', 'On progress', 'Done', { progress: 100 })
        ].sort((a, b) => b.ts - a.ts);

        return { jobs, log };
    }

    function ensureSeed() {
        if (read(KEYS.jobs, null) === null) {
            const s = seed();
            write(KEYS.jobs, s.jobs);
            write(KEYS.log, s.log);
        }
    }

    /* ---------- karyawan ---------- */
    function employees() {
        const saved = read(KEYS.emps, null);
        if (Array.isArray(saved)) return saved.filter(e => e && e.nik && e.name);
        return DEFAULT_EMPLOYEES.map(e => ({ ...e }));
    }
    function saveEmployees(list) {
        write(KEYS.emps, list);
        const map = {};
        list.forEach(e => { map[e.nik] = e.name; });
        write(KEYS.map, map);
    }

    /* ---------- pekerjaan ---------- */
    function jobs() { ensureSeed(); return read(KEYS.jobs, []); }
    function saveJobs(list) { return write(KEYS.jobs, list); }
    function log() { ensureSeed(); return read(KEYS.log, []); }
    const findIn = (list, prod) => list.find(j => String(j.prod).toLowerCase() === String(prod).toLowerCase());
    function findJob(prod) { return findIn(jobs(), prod); }

    function statusFromProgress(v) { return v >= 100 ? 'Done' : v <= 0 ? 'Planning' : 'On progress'; }
    const isHeld = job => job.status === 'Pending' || job.status === 'Cancel';

    /* Tampil di tanggal D bila: dibuat di tanggal itu, ATAU masih On progress dari hari sebelumnya
       (otomatis lanjut ke hari berikutnya), ATAU selesai di tanggal itu. */
    function visibleOn(job, date) {
        if (!date) return true;
        if (job.date === date) return true;
        if (job.status === 'On progress' && job.date < date) return true;
        if (job.status === 'Done' && job.doneDate === date) return true;
        return false;
    }

    function pushLog(job, from, to, by, role, extra) {
        const list = log();
        list.unshift(Object.assign({
            ts: Date.now(), date: today(), time: nowTime(), prod: job.prod, material: job.material, work: job.work, so: job.so,
            from, to, issue: '', reason: '', progress: job.progress, by, role
        }, extra || {}));
        write(KEYS.log, list);
    }

    function logFor(prod) { return log().filter(e => String(e.prod) === String(prod)); }

    function addJob(data, by, role) {
        const list = jobs();
        const prod = String(data.prod || '').trim();
        if (!prod) return { ok: false, error: 'Prod. Order wajib diisi.' };
        if (findIn(list, prod)) return { ok: false, error: `Prod. Order ${prod} sudah ada di daftar pekerjaan.` };

        const job = {
            prod, date: today(), material: data.material || '', work: data.work, so: data.so || '', qty: data.qty || '1 pc',
            team: (data.team || []).map(p => ({ id: p.id, name: p.name })), progress: 0, status: 'Planning'
        };
        list.push(job);
        if (!saveJobs(list)) return { ok: false, error: 'Gagal menyimpan. Penyimpanan browser tidak tersedia.' };
        pushLog(job, '—', 'Planning', by, role, { reason: 'Pekerjaan ditambahkan.' });
        return { ok: true, job };
    }

    function mutate(prod, fn) {
        const list = jobs();
        const job = findIn(list, prod);
        if (!job) return { ok: false, error: 'Pekerjaan tidak ditemukan.' };
        const res = fn(job);
        if (res && res.ok === false) return res;
        saveJobs(list);
        return { ok: true, job };
    }

    function setProgress(prod, value, by, role) {
        return mutate(prod, job => {
            if (isHeld(job)) return { ok: false, error: 'Pekerjaan sedang ' + job.status + '. Hanya Leader yang bisa mengaktifkan kembali.' };
            const from = job.status;
            job.progress = value;
            job.status = statusFromProgress(value);
            if (job.status === 'Done') job.doneDate = today(); else delete job.doneDate;
            if (job.status !== from) pushLog(job, from, job.status, by, role);
        });
    }

    function hold(prod, status, issue, reason, by, role) {
        return mutate(prod, job => {
            if (!['Pending', 'Cancel'].includes(status)) return { ok: false, error: 'Status tidak valid.' };
            if (!MASALAH.includes(issue)) return { ok: false, error: 'Pilih jenis masalah terlebih dahulu.' };
            if (!String(reason || '').trim()) return { ok: false, error: 'Alasan wajib diisi.' };
            if (isHeld(job)) return { ok: false, error: 'Pekerjaan sudah ' + job.status + '.' };
            const from = job.status;
            job.status = status; job.issue = issue; job.reason = reason.trim(); job.holdTime = nowTime(); job.holdBy = by;
            delete job.doneDate;
            pushLog(job, from, status, by, role, { issue, reason: job.reason });
        });
    }

    /* Hanya Leader */
    function reactivate(prod, by, role) {
        if (role !== 'Leader') return { ok: false, error: 'Hanya Leader yang dapat mengaktifkan kembali.' };
        return mutate(prod, job => {
            if (!isHeld(job)) return { ok: false, error: 'Pekerjaan tidak sedang pending/cancel.' };
            const from = job.status, prevIssue = job.issue, prevReason = job.reason;
            job.status = statusFromProgress(job.progress);
            if (job.status === 'Done') job.doneDate = today();
            delete job.issue; delete job.reason; delete job.holdTime; delete job.holdBy;
            pushLog(job, from, job.status, by, role, { issue: prevIssue || '', reason: 'Diaktifkan kembali oleh Leader. Alasan sebelumnya: ' + (prevReason || '-') });
        });
    }

    function addMember(prod, person) {
        return mutate(prod, job => {
            if (job.team.some(p => p.id === person.id)) return { ok: false, error: 'Karyawan sudah ada di tim.' };
            job.team.push({ id: person.id, name: person.name });
        });
    }
    function removeMember(prod, id) {
        return mutate(prod, job => { job.team = job.team.filter(p => p.id !== id); });
    }

    w.Store = {
        KEYS, BAGIAN, MASALAH, STATUSES, DEFAULT_EMPLOYEES,
        today, nowTime, fmtDate, esc, read, write,
        employees, saveEmployees,
        jobs, saveJobs, findJob, log, logFor, visibleOn, isHeld, statusFromProgress,
        addJob, setProgress, hold, reactivate, addMember, removeMember
    };
})(window);
