/* Logika dashboard bersama (Leader & Public).
   Halaman menentukan peran lewat: window.DASH_ROLE = 'Leader' | 'Public' */
(function () {
    const ROLE = window.DASH_ROLE || 'Public';
    const IS_LEADER = ROLE === 'Leader';
    const ACTOR = IS_LEADER ? 'Leader Section Viber' : 'Karyawan (Public)';
    const S = window.Store;
    const esc = S.esc;
    const $ = id => document.getElementById(id);
    const app = $('app');

    function statusClass(s) {
        return { 'On progress': 's-progress', 'Done': 's-done', 'Planning': 's-planning', 'Pending': 's-pending', 'Cancel': 's-cancel' }[s] || 's-planning';
    }

    let toastTimer;
    function toast(msg) {
        const t = $('teamToast');
        t.textContent = msg; t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    }

    /* ================= TABEL ================= */
    function render() {
        const query = $('searchInput').value.trim().toLowerCase();
        const status = $('statusFilter').value;
        const date = $('dateFilter').value;
        const all = S.jobs();

        const rows = all.filter(job => {
            if (!S.visibleOn(job, date)) return false;
            if (status !== 'all' && job.status !== status) return false;
            const text = `${job.prod} ${job.material} ${job.work} ${job.so} ${job.team.map(p => p.name + ' ' + p.id).join(' ')}`.toLowerCase();
            return !query || text.includes(query);
        });

        if (!rows.length) {
            $('tableBody').innerHTML = '<tr><td colspan="9" class="empty">Tidak ada pekerjaan yang sesuai dengan filter.</td></tr>';
        } else {
            $('tableBody').innerHTML = rows.map(job => {
                const hasTeam = job.team.length > 0;
                const held = S.isHeld(job);
                const carry = date && job.date < date && job.status === 'On progress'
                    ? `<span class="carry">↪ Lanjutan dari ${S.fmtDate(job.date)}</span>` : '';

                const team = hasTeam
                    ? `<div class="team-wrap">${job.team.map(p => `<span class="team-chip" title="${esc(p.id)}">${esc(p.name)}</span>`).join('')}</div>`
                    : '<span class="team-empty">Belum ditugaskan</span>';

                const bar = `<div class="track"><div class="fill ${job.status === 'Cancel' || !hasTeam ? 'gray' : ''}" style="width:${job.progress}%"></div></div><span class="percent">${job.progress}%</span>`;
                const progress = hasTeam
                    ? `<button type="button" class="progress-btn" data-act="progress" data-prod="${esc(job.prod)}" title="Klik untuk update progress pekerjaan" aria-label="Update progress, saat ini ${job.progress}%">${bar}</button>`
                    : `<div class="progress-btn static">${bar}</div>`;

                const statusBtn = `<button type="button" class="status ${statusClass(job.status)} ${held ? 'has-reason' : ''}" ${held ? `data-act="reason" data-prod="${esc(job.prod)}" aria-label="Lihat alasan ${job.status}"` : ''}>${job.status}${held && job.issue ? ` · ${esc(job.issue)}` : ''}</button>`;

                return `
                <tr>
                    <td><span class="material">${esc(job.prod)}</span></td>
                    <td class="so">${esc(job.material)}</td>
                    <td><span class="work">${esc(job.work)}</span>${carry}</td>
                    <td class="so">${esc(job.so)}</td>
                    <td class="qty">${esc(job.qty)}</td>
                    <td class="team-col">${team}</td>
                    <td class="progress-cell">${progress}</td>
                    <td>${statusBtn}</td>
                    <td class="action-col"><div class="actions">
                        ${IS_LEADER ? `<button type="button" class="icon-btn has-count" data-act="team" data-prod="${esc(job.prod)}" title="${hasTeam ? 'Kelola tim' : 'Tugaskan karyawan'}" aria-label="Kelola tim ${esc(job.work)}">👥<span class="count">${job.team.length}</span></button>` : ''}
                        <button type="button" class="icon-btn" data-act="history" data-prod="${esc(job.prod)}" title="Riwayat status" aria-label="Riwayat status ${esc(job.work)}">🕒</button>
                    </div></td>
                </tr>`;
            }).join('');
        }
        $('resultCount').textContent = `Menampilkan ${rows.length} dari ${all.length} pekerjaan`;
    }

    /* ================= RIWAYAT STATUS PER JOB ================= */
    function openHistory(job) {
        $('historyJobInfo').textContent = `Prod. Order ${job.prod} · ${job.work} · ${job.so}`;
        const entries = S.logFor(job.prod);
        $('historyList').innerHTML = entries.length ? entries.map(e => `
            <article class="history-item">
                <div class="history-item-top">
                    <div>
                        <div class="history-action">${esc(e.from)} → ${esc(e.to)}</div>
                        <div class="history-time">${S.fmtDate(e.date)} · ${esc(e.time)}</div>
                    </div>
                    <span class="status ${statusClass(e.to)}">${esc(e.to)}</span>
                </div>
                <div class="history-grid">
                    <div class="history-field"><label>Diubah oleh</label><strong>${esc(e.by)}</strong></div>
                    <div class="history-field"><label>Progress</label><strong>${e.progress}%</strong></div>
                    ${e.issue ? `<div class="history-field"><label>Masalah</label><strong><span class="issue-tag i-${esc(e.issue)}">${esc(e.issue)}</span></strong></div>` : ''}
                </div>
                ${e.reason ? `<div class="history-reason"><strong>Alasan:</strong> ${esc(e.reason)}</div>` : ''}
            </article>`).join('')
            : '<div class="history-empty">Belum ada riwayat status untuk pekerjaan ini.</div>';
        $('historyModal').classList.add('show');
        $('closeHistoryModal').focus();
    }
    const closeHistory = () => $('historyModal').classList.remove('show');
    $('closeHistoryModal').addEventListener('click', closeHistory);
    $('historyModal').addEventListener('click', e => { if (e.target === $('historyModal')) closeHistory(); });

    /* ================= POPUP PROGRESS (1 bar per job / tim) ================= */
    let pJob = null, pMode = '', pIssue = '';

    function paintSlider(v) {
        const pos = `calc(${v}% + ${(11 - v * 0.22).toFixed(2)}px)`;
        $('progressRange').style.setProperty('--p', pos);
        $('sliderBubble').style.left = pos;
        $('sliderBubble').textContent = `${v}%`;
    }

    function syncProgress() {
        if (!pJob) return;
        document.querySelectorAll('.pc-btn').forEach(b => {
            const on = b.dataset.mode === pMode;
            b.classList.toggle('selected', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        document.querySelectorAll('.m5-opt').forEach(b => b.classList.toggle('selected', b.dataset.val === pIssue));

        $('progressRange').disabled = !!pMode;
        $('progressReasonBox').hidden = !pMode;
        if (pMode) {
            $('progressReasonLabel').textContent = `Alasan ${pMode.toLowerCase()}`;
            $('progressReason').placeholder = `Tulis alasan kenapa ${pMode.toLowerCase()}...`;
        }
        const v = Number($('progressRange').value);
        $('saveProgressBtn').disabled = pMode ? false : v === pJob.progress;
        $('saveProgressBtn').textContent = pMode ? `Simpan ${pMode.toLowerCase()}` : 'Simpan progress';
    }

    function openProgress(job) {
        if (S.isHeld(job)) { openReason(job); return; }
        pJob = job; pMode = ''; pIssue = '';
        $('progressModalTitle').textContent = job.work;
        $('progressJobInfo').textContent = `Prod. Order ${job.prod} · Tim: ${job.team.map(p => p.name).join(', ')}`;
        $('progressBadge').textContent = job.status;
        $('progressBadge').className = `status ${statusClass(job.status)}`;
        $('progressRange').value = job.progress;
        paintSlider(job.progress);
        $('progressReason').value = '';
        $('progressError').textContent = '';
        syncProgress();
        $('progressModal').classList.add('show');
        $('progressRange').focus();
    }
    function closeProgress() { $('progressModal').classList.remove('show'); pJob = null; pMode = ''; pIssue = ''; }

    document.querySelectorAll('.pc-btn').forEach(btn => btn.addEventListener('click', () => {
        if (!pJob) return;
        pMode = pMode === btn.dataset.mode ? '' : btn.dataset.mode;
        $('progressError').textContent = '';
        if (pMode) { $('progressRange').value = pJob.progress; paintSlider(pJob.progress); }
        syncProgress();
    }));
    document.querySelectorAll('.m5-opt').forEach(btn => btn.addEventListener('click', () => {
        pIssue = btn.dataset.val;
        $('progressError').textContent = '';
        syncProgress();
    }));
    $('progressRange').addEventListener('input', () => { paintSlider(Number($('progressRange').value)); syncProgress(); });
    $('progressReason').addEventListener('input', () => { $('progressError').textContent = ''; });

    $('saveProgressBtn').addEventListener('click', () => {
        if (!pJob) return;
        const prod = pJob.prod;

        if (pMode) {
            if (!pIssue) { $('progressError').textContent = 'Pilih jenis masalah (Man, Material, Method, Machine, Environment).'; return; }
            const reason = $('progressReason').value.trim();
            if (!reason) { $('progressError').textContent = `Alasan ${pMode.toLowerCase()} wajib diisi.`; $('progressReason').focus(); return; }
            const res = S.hold(prod, pMode, pIssue, reason, ACTOR, ROLE);
            if (!res.ok) { $('progressError').textContent = res.error; return; }
            toast(`Pekerjaan diubah menjadi ${pMode} (${pIssue}).`);
        } else {
            const v = Number($('progressRange').value);
            const res = S.setProgress(prod, v, ACTOR, ROLE);
            if (!res.ok) { $('progressError').textContent = res.error; return; }
            toast(`Progress pekerjaan menjadi ${v}%.`);
        }
        closeProgress();
        render();
    });
    $('closeProgressModal').addEventListener('click', closeProgress);
    $('progressModal').addEventListener('click', e => { if (e.target === $('progressModal')) closeProgress(); });

    /* ================= POPUP ALASAN PENDING / CANCEL ================= */
    let rJob = null;
    function openReason(job) {
        rJob = job;
        const pending = job.status === 'Pending';
        $('reasonIcon').textContent = pending ? '⚠️' : '📄';
        $('reasonIcon').className = 'modal-icon ' + (pending ? 'pending' : 'cancel');
        $('reasonTitle').textContent = pending ? 'Alasan Pending' : 'Alasan Cancel';
        $('reasonWork').textContent = job.work;
        $('reasonEmployee').textContent = `Prod. Order ${job.prod} · ${job.team.map(p => p.name).join(', ')}`;
        $('reasonTime').textContent = `${job.holdTime || '—'} · ${S.fmtDate(job.date)} · Progress ${job.progress}%`;
        $('reasonIssue').innerHTML = job.issue ? `<span class="issue-tag i-${esc(job.issue)}">${esc(job.issue)}</span>` : '<span class="team-empty">—</span>';
        $('reasonCopy').textContent = job.reason || 'Belum ada alasan yang ditambahkan.';
        $('reasonCopy').className = 'reason-copy ' + (pending ? 'pending' : 'cancel');
        $('reasonLockNote').hidden = IS_LEADER;
        $('reactivateBtn').disabled = !IS_LEADER;
        $('reasonModal').classList.add('show');
        $('closeReason').focus();
    }
    function closeReason() { $('reasonModal').classList.remove('show'); rJob = null; }

    $('reactivateBtn').addEventListener('click', () => {
        if (!rJob) return;
        if (!IS_LEADER) { toast('Hanya Leader yang dapat mengaktifkan kembali.'); return; }
        const res = S.reactivate(rJob.prod, ACTOR, ROLE);
        if (!res.ok) { toast(res.error); return; }
        closeReason();
        render();
        toast(`Pekerjaan diaktifkan kembali (${res.job.status}).`);
    });
    $('closeReason').addEventListener('click', closeReason);
    $('reasonModal').addEventListener('click', e => { if (e.target === $('reasonModal')) closeReason(); });

    /* ================= KELOLA TIM (Leader) ================= */
    let tJob = null;
    function renderTeam() {
        if (!tJob) return;
        tJob = S.findJob(tJob.prod);
        $('teamJobInfo').textContent = `Prod. Order ${tJob.prod} · ${tJob.work} · ${tJob.so}`;
        $('assignedEmployees').innerHTML = tJob.team.length
            ? tJob.team.map(p => `
                <div class="team-member-row">
                    <div><div class="team-member-name">${esc(p.name)}</div><div class="team-member-id">${esc(p.id)}</div></div>
                    <button type="button" class="team-remove-btn" data-remove="${esc(p.id)}">Lepas dari pekerjaan</button>
                </div>`).join('')
            : '<div class="team-note" style="margin-top:0">Belum ada karyawan yang ditugaskan. Pilih karyawan di bawah lalu klik Tambahkan.</div>';

        const free = S.employees().filter(e => !tJob.team.some(p => p.id === e.nik));
        $('employeeSelect').innerHTML = '<option value="">Pilih karyawan...</option>' +
            free.map(e => `<option value="${esc(e.nik)}">${esc(e.name)} (${esc(e.nik)})${e.bagian ? ' · ' + esc(e.bagian) : ''}</option>`).join('');
        $('addEmployeeBtn').disabled = !free.length;
    }
    function openTeam(job) { tJob = job; renderTeam(); $('teamModal').classList.add('show'); $('closeTeamModal').focus(); }
    function closeTeam() { $('teamModal').classList.remove('show'); tJob = null; render(); }

    if (IS_LEADER) {
        $('assignedEmployees').addEventListener('click', e => {
            const btn = e.target.closest('[data-remove]');
            if (!btn || !tJob) return;
            const person = tJob.team.find(p => p.id === btn.dataset.remove);
            S.removeMember(tJob.prod, btn.dataset.remove);
            renderTeam(); render();
            if (person) toast(`${person.name} dilepas dari pekerjaan.`);
        });
        $('addEmployeeBtn').addEventListener('click', () => {
            if (!tJob) return;
            const id = $('employeeSelect').value;
            if (!id) { toast('Pilih karyawan terlebih dahulu.'); return; }
            const emp = S.employees().find(x => x.nik === id);
            if (!emp) return;
            const res = S.addMember(tJob.prod, { id: emp.nik, name: emp.name });
            if (!res.ok) { toast(res.error); return; }
            renderTeam(); render();
            toast(`${emp.name} ditambahkan ke tim.`);
        });
        $('closeTeamModal').addEventListener('click', closeTeam);
        $('teamModal').addEventListener('click', e => { if (e.target === $('teamModal')) closeTeam(); });
    }

    /* ================= FORM TAMBAH JOB MANUAL ================= */
    let manualPeople = [];
    const fillNikList = () => {
        $('nikList').innerHTML = S.employees().map(p => `<option value="${esc(p.nik)}">${esc(p.name)}</option>`).join('');
    };
    function renderChips() {
        $('nikChips').innerHTML = manualPeople.map(p => `
            <span class="nik-chip">${esc(p.name)} <small>${esc(p.id)}</small>
            <button type="button" data-rm-nik="${esc(p.id)}" aria-label="Hapus ${esc(p.name)}">×</button></span>`).join('');
    }
    function commitNik() {
        const tokens = $('mNik').value.split(/[,;\s]+/).map(t => t.trim()).filter(Boolean);
        const failed = [];
        const emps = S.employees();
        tokens.forEach(t => {
            const p = emps.find(e => e.nik.toLowerCase() === t.toLowerCase());
            if (!p) { failed.push(t); return; }
            if (!manualPeople.some(x => x.id === p.nik)) manualPeople.push({ id: p.nik, name: p.name });
        });
        $('mNik').value = failed.join(', ');
        renderChips();
        if (failed.length) {
            $('manualError').textContent = `NIK ${failed.join(', ')} tidak ditemukan. ${IS_LEADER ? 'Tambahkan dulu di halaman Karyawan, atau' : 'Minta Leader menambahkannya di halaman Karyawan, atau'} hapus dari kolom NIK.`;
            return false;
        }
        return true;
    }
    $('addNikBtn').addEventListener('click', () => { $('manualError').textContent = ''; if (commitNik()) $('mNik').focus(); });
    $('mNik').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); $('manualError').textContent = ''; commitNik(); }
    });
    $('nikChips').addEventListener('click', e => {
        const b = e.target.closest('[data-rm-nik]'); if (!b) return;
        manualPeople = manualPeople.filter(p => p.id !== b.dataset.rmNik); renderChips();
    });
    $('manualForm').addEventListener('input', () => { $('manualError').textContent = ''; });

    $('manualForm').addEventListener('submit', e => {
        e.preventDefault();
        const prod = $('mProd').value.trim();
        const material = $('mMaterial').value.trim();
        const so = $('mSo').value.trim();
        const work = $('mWork').value.trim().replace(/\s+/g, ' ');
        const qty = Math.floor(Number($('mQty').value));
        const fail = m => { $('manualError').textContent = m; };

        if (!prod || !material || !so || !work) { fail('Prod. Order, No. Material, No. SO, dan Pekerjaan wajib diisi.'); return; }
        if (!qty || qty < 1) { fail('Qty minimal 1.'); return; }
        if (!commitNik()) return;

        const res = S.addJob({ prod, material, so, work, qty: `${qty} pc${qty > 1 ? 's' : ''}`, team: manualPeople }, ACTOR, ROLE);
        if (!res.ok) { fail(res.error); return; }

        const n = manualPeople.length;
        $('manualForm').reset(); $('mQty').value = 1;
        manualPeople = []; renderChips();
        $('dateFilter').value = ''; $('searchInput').value = ''; $('statusFilter').value = 'all';
        render();
        toast(n ? `Job ditambahkan dan ditugaskan ke ${n} karyawan.` : 'Job ditambahkan. Belum ada karyawan yang ditugaskan.');
    });

    /* ================= EVENT UMUM ================= */
    $('tableBody').addEventListener('click', e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const job = S.findJob(btn.dataset.prod);
        if (!job) return;
        const act = btn.dataset.act;
        if (act === 'team') openTeam(job);
        if (act === 'history') openHistory(job);
        if (act === 'progress') openProgress(job);
        if (act === 'reason') openReason(job);
    });

    ['input', 'change'].forEach(ev => {
        $('searchInput').addEventListener(ev, render);
        $('statusFilter').addEventListener(ev, render);
        $('dateFilter').addEventListener(ev, render);
    });
    $('clearDate').addEventListener('click', () => { $('dateFilter').value = ''; render(); });

    $('toggleBtn').addEventListener('click', () => {
        if (window.innerWidth <= 650) app.classList.toggle('mobile-open'); else app.classList.toggle('collapsed');
    });
    $('overlay').addEventListener('click', () => app.classList.remove('mobile-open'));

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if ($('reasonModal').classList.contains('show')) closeReason();
        if ($('progressModal').classList.contains('show')) closeProgress();
        if ($('historyModal').classList.contains('show')) closeHistory();
        if (IS_LEADER && $('teamModal').classList.contains('show')) closeTeam();
    });

    $('logoutBtn').addEventListener('click', () => {
        if (confirm('Apakah kamu yakin ingin logout?')) window.location.href = '../Login.html';
    });

    /* Sinkron bila data diubah di tab/halaman lain */
    window.addEventListener('storage', e => { if (e.key === S.KEYS.jobs || e.key === S.KEYS.log) render(); });
    window.addEventListener('pageshow', render);

    fillNikList();
    render();
})();
