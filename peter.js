class EventManager {
	constructor() {
		this.events = [];
		this.participants = new Map(); // email -> [eventIds] mapping
		this.eventIdCounter = 1;
		this.config = {};
		this.currentUser = null;
		this.editingEventId = null; // when set, form submit will update existing event
		// Admin password is now validated against the server-side DB
		this.apiBase = '/eventmanager/api'; // <-- new: base path to PHP API
		this.init();
	}

	init() {
		this.bindEvents();
		// load persisted data from server, then update UI
		this.loadData().then(() => {
			this.updateDisplay();
		}).catch((err) => {
			console.warn('Kon data niet laden:', err);
			this.updateDisplay();
		});
	}

	bindEvents() {
		document.getElementById('eventForm').addEventListener('submit', (e) => {
			e.preventDefault();
			this.addEvent();
		});

		document.getElementById('studentRegistrationForm').addEventListener('submit', (e) => {
			e.preventDefault();
			this.registerParticipant();
		});

		document.getElementById('clearEvents').addEventListener('click', () => {
			this.clearAllEvents();
		});

		// Save global config (admins)
		const saveGlobalBtn = document.getElementById('saveGlobal');
		if (saveGlobalBtn) {
			saveGlobalBtn.addEventListener('click', () => {
				const val = document.getElementById('globalDate').value;
				this.config = this.config || {};
				this.config.date = val || null;
				this.saveData().then(ok => { if (ok) this.showSuccess('Algemene instellingen opgeslagen.'); });
			});
		}

		// Enter key voor admin login
		document.getElementById('adminPassword').addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				this.adminLogin();
			}
		});
	}

	selectRole(role) {
		if (role === 'admin') {
			document.getElementById('adminLogin').style.display = 'block';
			document.getElementById('adminPassword').focus();
		} else {
			this.currentUser = { role: 'student' };
			this.showInterface();
		}
	}

	adminLogin() {
		const username = document.getElementById('adminUsername').value;
		const password = document.getElementById('adminPassword').value;
		if (!username) { this.showError('Voer een gebruikersnaam in.'); return; }
		if (!password) { this.showError('Voer een wachtwoord in.'); return; }
		// Call server to validate
		fetch(`/api/data.php`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'login', username, password })
		}).then(async resp => {
			if (!resp.ok) {
				const txt = await resp.text();
				this.showError('Login mislukt: ' + (txt || resp.status));
				return;
			}
			const data = await resp.json();
			if (data && data.success) {
				this.currentUser = { role: 'admin', username: data.username };
				this.showInterface();
			} else {
				this.showError('Onjuist wachtwoord.');
			}
		}).catch(err => {
			console.error('Login error', err);
			this.showError('Kan geen verbinding maken met de server.');
		});
	}

	logout() {
		this.currentUser = null;
		document.getElementById('authPanel').style.display = 'block';
		document.getElementById('userInfo').style.display = 'none';
		document.getElementById('adminPanel').style.display = 'none';
		document.getElementById('registrationForm').style.display = 'none';
		document.getElementById('adminLogin').style.display = 'none';
		const cfgBox = document.getElementById('globalConfigBox');
		if (cfgBox) cfgBox.style.display = 'none';
		document.getElementById('adminUsername').value = '';
		document.getElementById('adminPassword').value = '';
		const manualLink = document.getElementById('manualLink');
		if (manualLink) manualLink.style.display = 'none';
	}

	showInterface() {
		document.getElementById('authPanel').style.display = 'none';
		document.getElementById('userInfo').style.display = 'flex';

		const roleText = this.currentUser.role === 'admin' ? '👨‍💼 Administrator' : '👨‍🎓 Student';
		document.getElementById('userRole').textContent = roleText;

		if (this.currentUser.role === 'admin') {
			document.getElementById('adminPanel').style.display = 'block';
			document.getElementById('statisticsPanel').style.display = 'block';
			const manualLink = document.getElementById('manualLink');
			if (manualLink) manualLink.style.display = 'block';

			// Use the top `globalConfigBox` as the single global setting UI.
			const cfgBox = document.getElementById('globalConfigBox');
			if (cfgBox) {
				cfgBox.style.display = 'block';
				const inp = document.getElementById('globalDateBox');
				const saveBtn = document.getElementById('saveGlobalBox');
				if (inp) {
					inp.value = this.config.date || '';
					// only admins can edit; students see the global date read-only
					inp.disabled = this.currentUser.role !== 'admin';
				}
				if (saveBtn) {
					saveBtn.style.display = this.currentUser.role === 'admin' ? 'inline-block' : 'none';
					if (this.currentUser.role === 'admin' && !saveBtn._bound) {
						saveBtn.addEventListener('click', () => {
							this.config = this.config || {};
							this.config.date = (document.getElementById('globalDateBox') && document.getElementById('globalDateBox').value) || null;
							this.saveData().then(ok => { if (ok) this.showSuccess('Algemene instellingen opgeslagen.'); });
						});
						saveBtn._bound = true;
					}
		// Autofill the event date input with the global date when available
		const eventDateInput = document.getElementById('eventDate');
		if (eventDateInput && !eventDateInput.value && this.config && this.config.date) {
			eventDateInput.value = this.config.date;
		}
				}
			}
		} else {
			document.getElementById('registrationForm').style.display = 'block';
			document.getElementById('statisticsPanel').style.display = 'none';
			const cfgBoxHide = document.getElementById('globalConfigBox');
			if (cfgBoxHide) cfgBoxHide.style.display = 'none';
			const manualLink = document.getElementById('manualLink');
			if (manualLink) manualLink.style.display = 'none';
		}

		this.updateDisplay();
	}

	async loadData() {
		try {
			//const resp = await fetch(`${this.apiBase}/data.php`);
			const resp = await fetch(`/api/data.php`);
			console.log(`/api/data.php`);
			if (!resp.ok) throw new Error('Server returned ' + resp.status);
			const data = await resp.json();

			console.log('Loaded data:', data);

			// Normalize events and participant dates (server stores ISO strings)
			this.events = (data.events || []).map(ev => {
				// ensure numeric fields
				ev.maxParticipants = parseInt(ev.maxParticipants) || 0;

				// rounds may be stored as JSON string
				if (typeof ev.rounds === 'string') {
					try { ev.rounds = JSON.parse(ev.rounds); } catch (e) {
						// fall back to comma separated numbers
						ev.rounds = ev.rounds.split(',').map(x => parseInt(x));
					}
				}

				// Normalize rounds into objects: {round: number, time: 'HH:MM'}
				if (!ev.rounds) ev.rounds = [];
				ev.rounds = ev.rounds.map(r => {
					if (r && typeof r === 'object' && r.round) return { round: parseInt(r.round), time: r.time || '' };
					const n = parseInt(r);
					if (!isNaN(n)) return { round: n, time: '' };
					// final fallback
					return { round: parseInt(r) || 0, time: '' };
				});

				// participants may be stored as JSON string
				if (typeof ev.participants === 'string') {
					try { ev.participants = JSON.parse(ev.participants); } catch (e) { ev.participants = []; }
				}
				ev.participants = (ev.participants || []).map(p => {
					if (p) {
						if (p.registeredAt) p.registeredAt = new Date(p.registeredAt);
						// normalize ronde to number when possible
						if (p.ronde !== undefined && p.ronde !== null) {
							const rn = parseInt(p.ronde);
							p.ronde = isNaN(rn) ? p.ronde : rn;
						}
					}
					return p;
				});

				// createdAt normalization
				if (ev.createdAt) ev.createdAt = new Date(ev.createdAt);

				return ev;
			});

			this.eventIdCounter = data.eventIdCounter || (this.events.reduce((m,e)=>Math.max(m,e.id||0),0) + 1) || 1;

			// load global config if present
			this.config = data.config || {};

			const parts = data.participants || {};
			const entries = Object.entries(parts).map(([k, v]) => {
				// event id lists may be stored as JSON strings
				if (typeof v === 'string') {
					try { v = JSON.parse(v); } catch (e) { v = []; }
				}
				return [k, v];
			});
			this.participants = new Map(entries);
		} catch (err) {
			console.error('loadData error', err);
			throw err;
		}
	}

	// New: save current in-memory state to PHP JSON store
	async saveData() {
		try {
			// convert participants Map -> plain object
			const participantsObj = {};
			for (const [k, v] of this.participants.entries()) participantsObj[k] = v;

			const payload = {
				events: this.events,
				participants: participantsObj,
				eventIdCounter: this.eventIdCounter
			};

			// include global config for persistence
			payload.config = this.config || {};

			const resp = await fetch(`/api/data.php`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!resp.ok) {
				const txt = await resp.text();
				throw new Error('Save failed: ' + txt);
			}
			const result = await resp.json();
			if (!result.success) throw new Error(result.message || 'Unknown server error');
			return true;
		} catch (err) {
			console.error('saveData error', err);
			this.showError('Kon data niet opslaan op de server.');
			return false;
		}
	}

	async addEvent() {
		const name = document.getElementById('eventName').value;
		const description = document.getElementById('eventDescription').value;
		const workshopLeader = document.getElementById('workshopLeader').value;
		let eventDate = document.getElementById('eventDate').value; // YYYY-MM-DD
		const maxParticipants = parseInt(document.getElementById('maxParticipants').value);
		const location = document.getElementById('location').value;
		// collect rounds from admin checkboxes and associated time inputs
		const roundCheckboxes = Array.from(document.querySelectorAll('.roundCheckbox'));
		const rounds = roundCheckboxes.filter(cb => cb.checked).map(cb => {
			const num = parseInt(cb.value);
			const timeInput = document.querySelector(`.roundTime[data-round="${num}"]`);
			const time = timeInput ? timeInput.value : '';
			return { round: num, time };
		});

		if (rounds.length === 0) {
			this.showError('Selecteer minimaal één ronde voor de workshop.');
			return;
		}

		// If admin didn't fill event date, fall back to global config date (if set)
		if (!eventDate && this.config && this.config.date) {
			eventDate = this.config.date;
		}

		if (!eventDate) {
			this.showError('Selecteer een datum voor de workshop.');
			return;
		}

		// If we're editing an existing event, update it instead of creating a new one
		if (this.editingEventId) {
			const idx = this.events.findIndex(e => e.id === this.editingEventId);
			if (idx !== -1) {
				// preserve participants and createdAt
				const existing = this.events[idx];
				existing.name = name;
				existing.description = description;
				existing.workshopLeader = workshopLeader;
				existing.date = eventDate;
				existing.maxParticipants = maxParticipants;
				existing.location = location;
				existing.rounds = rounds;

				const ok = await this.saveData();
				if (!ok) return;

				this.updateDisplay();
				this.clearForm('eventForm');
				this.editingEventId = null;
				this.showSuccess('Event succesvol bijgewerkt!');
				return;
			}
			// if editing id not found, fall through to create new
			this.editingEventId = null;
		}

		const event = {
			id: this.eventIdCounter++,
			name,
			description,
			workshopLeader,
			date: eventDate,
			maxParticipants,
			location,
			rounds,
			participants: [],
			createdAt: new Date()
		};

		this.events.push(event);

		// persist
		const ok = await this.saveData();
		if (!ok) return;

		this.updateDisplay();
		this.clearForm('eventForm');
		this.showSuccess('Event succesvol toegevoegd!');
	}


	async registerParticipant() {
		const name = document.getElementById('participantName').value;
        const email = document.getElementById('participantEmail').value.trim().toLowerCase();
		const studentNumber = document.getElementById('studentnummer').value.trim();

		// Ensure a valid numeric student number of 5-6 digits
		if (!/^[0-9]{5,6}$/.test(studentNumber)) {
			this.showError('Voer een geldig studentnummer in van 5 of 6 cijfers.');
			return;
		}
		const studentProgram = document.getElementById('studentProgram').value;

		// Each select corresponds to a ronde: eventSelect => ronde 1, eventSelect2 => ronde 2, eventSelect3 => ronde 3
		const selectMap = [
			{ id: 'eventSelect', ronde: 1 },
			{ id: 'eventSelect2', ronde: 2 },
			{ id: 'eventSelect3', ronde: 3 }
		];

			const selectedMap = selectMap.map(s => ({
				value: document.getElementById(s.id).value,
				ronde: s.ronde
			})).filter(s => s.value);

			// Ensure at least one workshop is selected (form `novalidate` disables browser checks)
			if (selectedMap.length === 0) {
				this.showError('Selecteer minimaal één workshop (kies een ronde).');
				return;
			}

            const selectedIds = selectedMap.map(s => parseInt(s.value));
            const uniqueEventIds = [...new Set(selectedIds)];

			// Stepwise validation with clear user feedback
			const allowedDomains = ['roc-teraa.nl', 'ter-aa.nl'];
			// basic presence of @
			if (!email || email.indexOf('@') === -1) {
				this.showError('Ongeldig e-mailadres: ontbreekt het "@" teken?');
				return;
			}

			const parts = email.split('@');
			if (parts.length !== 2) {
				this.showError('Ongeldig e-mailadres: teveel of te weinig "@" tekens.');
				return;
			}

			let [localPart, domainPart] = parts.map(p => p.trim().toLowerCase());

			// local part must start with the numeric student number (allow +tag or .suffix)
			if (!/^[0-9]{5,6}/.test(localPart)) {
				this.showError(`Het gedeelte vóór @ moet beginnen met je studentnummer (5-6 cijfers). Gegeven: "${localPart}"`);
				return;
			}

			if (!localPart.startsWith(studentNumber)) {
				this.showError(`Studentnummer komt niet overeen met het e-mailadres. Studentnummer: ${studentNumber}, e-mail lokaal deel: "${localPart}"`);
				return;
			}

			// domain: accept exact or subdomain (e.g. mail.roc-teraa.nl)
			const domainOk = allowedDomains.some(d => domainPart === d || domainPart.endsWith('.' + d));
			if (!domainOk) {
				this.showError(`Ongeldig domein: gebruik een Ter AA domein zoals ${allowedDomains.join(' of ')}. Gegeven: "${domainPart}"`);
				return;
			}

			// final sanity: validate overall email with a permissive regex
			// allow local parts with letters/numbers/+-._ and hyphenated domains
			const permissiveEmailRe = /^[A-Za-z0-9+._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
			if (!permissiveEmailRe.test(email)) {
				this.showError(`E-mailadres lijkt ongeldig: "${email}"`);
				return;
			}
		if (uniqueEventIds.length !== selectedIds.length) {
			this.showError('Je hebt hetzelfde event meer dan eens geselecteerd!');
			return;
		}

		const currentEvents = this.participants.get(email) || [];

		if (currentEvents.length + uniqueEventIds.length > 3) {
			this.showError('Je kunt je maximaal voor 3 workshops aanmelden!');
			return;
		}

		const newEvents = [];

		for (const sel of selectedMap) {
			const eventId = parseInt(sel.value);
			const requestedRonde = sel.ronde;

			if (currentEvents.includes(eventId)) {
				this.showError('Je bent al aangemeld voor een van deze workshops!');
				return;
			}

			// const event = this.events.find(e => e.id === eventId);
			const event = this.events.find(e => parseInt(e.id, 10) === eventId);
			if (!event) {
				this.showError(`Event met ID ${eventId} niet gevonden!`);
				return;
			}

			if (event.participants.length >= event.maxParticipants) {
				this.showError(`Event "${event.name}" is vol!`);
				return;
			}

			// Ensure the event includes the requested ronde
			if (!event.rounds || !event.rounds.some(r => parseInt(r.round) === parseInt(requestedRonde))) {
				this.showError(`Event "${event.name}" is niet beschikbaar in Ronde ${requestedRonde}.`);
				return;
			}

			// Build helper to get a Date object for an event's round time
			const getRoundDateTime = (ev, roundNumber) => {
				if (!ev || !ev.date || !ev.rounds) return null;
				const r = ev.rounds.find(x => parseInt(x.round) === parseInt(roundNumber));
				if (!r || !r.time) return null;
				const iso = `${ev.date}T${r.time}`;
				const d = new Date(iso);
				if (isNaN(d.getTime())) return null;
				return d;
			};

			// Compare chosen ronde datetime against existing registrations (coarse check: any ronde time match)
			const newEventTime = getRoundDateTime(event, requestedRonde);
			const hasTimeConflict = currentEvents.some(id => {
				const e = this.events.find(ev => ev.id === id);
				if (!e) return false;
				return e.rounds && e.rounds.some(rr => {
					const existingDT = getRoundDateTime(e, rr.round);
					return existingDT && newEventTime && existingDT.getTime() === newEventTime.getTime();
				});
			}) || newEvents.some(en => {
				const existingDT = getRoundDateTime(en.event, en.ronde);
				return existingDT && newEventTime && existingDT.getTime() === newEventTime.getTime();
			});

			if (hasTimeConflict) {
				this.showError(`Tijdconflict gevonden voor "${event.name}"!`);
				return;
			}

			newEvents.push({ event, ronde: requestedRonde });
		}

		const participant = {
			name,
			email,
			studentNumber,
			studentProgram,
			registeredAt: new Date()
		};

		for (const entry of newEvents) {
			// create a per-event participant record that includes the chosen ronde
			const perEventParticipant = Object.assign({}, participant, { ronde: entry.ronde });
			entry.event.participants.push(perEventParticipant);
			currentEvents.push(entry.event.id);
		}

		this.participants.set(email, currentEvents);

		// persist
		const ok = await this.saveData();
		if (!ok) return;

		this.updateDisplay();
		this.clearForm('studentRegistrationForm');
		this.showSuccess(`Succesvol aangemeld voor: ${newEvents.map(e => `"${e.event.name}" (Ronde ${e.ronde})`).join(', ')}`);

		// prepare email payload
		const emailPayload = {
			to: email,
			name,
			events: newEvents.map(e => `${e.event.name} (Ronde ${e.ronde})`),
			studentNumber,
			studentProgram
		};

		try {
			const resp = await fetch(`/api/send-confirmation.php`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(emailPayload)
			});

			if (!resp.ok) {
				const err = await resp.text();
				console.error('Email sending failed:', err);
				this.showError('Er ging iets mis bij het versturen van de bevestiging (server).');
			} else {
				const r = await resp.json();
				if (r.success) {
					this.showSuccess(`Succesvol aangemeld voor: ${newEvents.map(e => `"${e.event.name}"`).join(', ')} — bevestiging verzonden.`);
				} else {
					console.error('Email endpoint error:', r);
					this.showError('Bevestiging niet verzonden (server).');
				}
			}
		} catch (err) {
			console.error('Network error while sending email:', err);
			this.showError('Kan geen verbinding maken met de server om de bevestiging te sturen.');
		}
	}

	removeParticipant(eventId, email) {
		const event = this.events.find(e => e.id === eventId);
		if (event && this.currentUser.role === 'admin') {
			event.participants = event.participants.filter(p => p.email !== email);

			// Update participant mapping
			const currentEvents = this.participants.get(email) || [];
			const updatedEvents = currentEvents.filter(id => id !== eventId);
			if (updatedEvents.length === 0) {
				this.participants.delete(email);
			} else {
				this.participants.set(email, updatedEvents);
			}

			// persist
			this.saveData();

			this.updateDisplay();
		}
	}

	clearAllEvents() {
		if (confirm('Weet je zeker dat je alle workshops wilt wissen?')) {
			this.events = [];
			this.participants.clear();
			this.eventIdCounter = 1;
			// persist
			this.saveData();
			this.updateDisplay();
			this.showSuccess('Alle events zijn gewist!');
		}
	}

	exportToCSV() {
// helper to escape CSV fields
const esc = (val) => {
if (val === null || val === undefined) return '';
const s = String(val);
return '"' + s.replace(/"/g, '""') + '"';
};

let csv = 'Event ID,Event Naam,Beschrijving,Workshop Leider,Datum,Tijd,Locatie,Rondes,Max Deelnemers,Aantal Aanmeldingen,Created At,Deelnemer Naam,Email,Leerlingnummer,Opleiding,Ronde,Aanmelddatum\n';

this.events.forEach(event => {
const dateStr = event.date || '';
const roundsNumbers = event.rounds && event.rounds.length ? event.rounds.map(r => `Ronde ${r.round}`).join(', ') : '';
const timeStr = event.rounds && event.rounds.length ? event.rounds.map(r => r.time || '').filter(t => t).join(' | ') : '';
const createdAtStr = event.createdAt && event.createdAt.toISOString ? event.createdAt.toISOString() : (event.createdAt || '');
const baseArr = [event.id || '', event.name || '', event.description || '', event.workshopLeader || '', dateStr, timeStr, event.location || '', roundsNumbers, event.maxParticipants || 0, event.participants.length || 0, createdAtStr];

if (!event.participants || event.participants.length === 0) {
csv += baseArr.map(esc).join(',') + ',,,,,,\n';
} else {
event.participants.forEach(participant => {
const regAt = participant.registeredAt && participant.registeredAt.toISOString ? participant.registeredAt.toISOString() : (participant.registeredAt || '');
const row = baseArr.concat([participant.name || '', participant.email || '', participant.studentNumber || '', participant.studentProgram || '', participant.ronde || '', regAt]);
csv += row.map(esc).join(',') + '\n';
});
}
});

this.downloadFile(csv, 'events-export.csv', 'text/csv');
}exportToExcel() {
// Simple HTML table format that Excel can open
let html = '<table border="1">';
html += '<tr><th>Event ID</th><th>Event Naam</th><th>Beschrijving</th><th>Workshop Leider</th><th>Datum</th><th>Tijd</th><th>Rondes</th><th>Locatie</th><th>Max Deelnemers</th><th>Aantal Aanmeldingen</th><th>Created At</th><th>Deelnemer Naam</th><th>Email</th><th>Leerlingnummer</th><th>Opleiding</th><th>Ronde</th><th>Aanmelddatum</th></tr>';

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

this.events.forEach(event => {
const dateStr = event.date || '';
const roundsNumbers = event.rounds && event.rounds.length ? event.rounds.map(r => `Ronde ${r.round}`).join(', ') : '';
const timeStr = event.rounds && event.rounds.length ? event.rounds.map(r => r.time || '').filter(t => t).join(' | ') : '';
const createdAtStr = event.createdAt && event.createdAt.toISOString ? event.createdAt.toISOString() : (event.createdAt || '');
const baseInfo = `<td>${event.id || ''}</td><td>${escapeHtml(event.name || '')}</td><td>${escapeHtml(event.description || '')}</td><td>${escapeHtml(event.workshopLeader || '')}</td><td>${escapeHtml(dateStr)}</td><td>${escapeHtml(timeStr)}</td><td>${escapeHtml(roundsNumbers)}</td><td>${escapeHtml(event.location || '')}</td><td>${event.maxParticipants || 0}</td><td>${event.participants.length || 0}</td><td>${escapeHtml(createdAtStr)}</td>`;

if (!event.participants || event.participants.length === 0) {
html += '<tr>' + baseInfo + '<td></td><td></td><td></td><td></td><td></td></tr>';
} else {
event.participants.forEach(participant => {
const regAt = participant.registeredAt && participant.registeredAt.toISOString ? participant.registeredAt.toISOString() : (participant.registeredAt || '');
html += '<tr>' + baseInfo + `<td>${escapeHtml(participant.name || '')}</td><td>${escapeHtml(participant.email || '')}</td><td>${escapeHtml(participant.studentNumber || '')}</td><td>${escapeHtml(participant.studentProgram || '')}</td><td>${escapeHtml(participant.ronde || '')}</td><td>${escapeHtml(regAt)}</td></tr>`;
});
}
});

html += '</table>';
const fileDate = (this.config && this.config.date) ? this.config.date : (new Date().toISOString().slice(0,10));
this.downloadFile(html, 'workshops-' + fileDate + '.xls', 'application/vnd.ms-excel');
}downloadFile(content, filename, contentType) {
		const blob = new Blob([content], { type: contentType });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}

	deleteEvent(id) {
		this.events = this.events.filter(e => e.id !== id);
		// remove references in participants map
		for (const [email, arr] of this.participants.entries()) {
			const updated = arr.filter(x => x !== id);
			if (updated.length) this.participants.set(email, updated); else this.participants.delete(email);
		}
		// persist
		this.saveData();
		this.updateDisplay();
		this.showSuccess('Workshop verwijderd!');
	}

	copyEvent(id) {
		const eventToCopy = this.events.find(e => e.id === id);
		if (eventToCopy) {
			// Fill form fields with existing event data
			document.getElementById('eventName').value = eventToCopy.name;
			document.getElementById('eventDescription').value = eventToCopy.description;
			document.getElementById('workshopLeader').value = eventToCopy.workshopLeader;
			document.getElementById('location').value = eventToCopy.location;
			document.getElementById('maxParticipants').value = eventToCopy.maxParticipants;
			// set round checkboxes
			const checkboxes = Array.from(document.querySelectorAll('.roundCheckbox'));
			checkboxes.forEach(cb => {
				cb.checked = eventToCopy.rounds ? eventToCopy.rounds.some(r => parseInt(r.round) === parseInt(cb.value)) : false;
				// set corresponding time input if available
				const timeInput = document.querySelector(`.roundTime[data-round="${cb.value}"]`);
				if (timeInput && eventToCopy.rounds) {
					const found = eventToCopy.rounds.find(r => parseInt(r.round) === parseInt(cb.value));
					if (found) timeInput.value = found.time || '';
				}
			});

			// Put the form into edit mode for this existing event
			document.getElementById('eventDate').value = eventToCopy.date || '';
			this.editingEventId = eventToCopy.id;

			this.showSuccess('Workshop gegevens geladen in bewerk-modus. Klik op toevoegen om wijzigingen op te slaan.');
		}
	}

	updateDisplay() {
		this.updateEventsGrid();
		this.updateEventSelect();
		if (this.currentUser && this.currentUser.role === 'admin') {
			this.updateStatistics();
		}
	}

	updateEventsGrid() {
		const grid = document.getElementById('eventsGrid');

		if (this.events.length === 0) {
			grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;"><h3>Nog geen workshops aangemaakt</h3><p>Gebruik het formulier hierboven om je eerste workshop toe te voegen.</p></div>';
			return;
		}

		// Always render events for all users. Admin-only controls are inserted conditionally.
		grid.innerHTML = this.events.map(event => {
			const isFull = event.participants.length >= event.maxParticipants;
			const dateObj = event.date ? new Date(event.date) : null;
			const dateLabel = dateObj ? dateObj.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' }) : '-';
			const roundsHtml = event.rounds && event.rounds.length ? event.rounds.map(r => `${r.time ? `<div><strong>Ronde ${r.round}:</strong> ${r.time}</div>` : `<div><strong>Ronde ${r.round}:</strong> geen tijd</div>`}`).join('') : '<div>Geen rondes</div>';

			return `
				<div class="event-card ${isFull ? 'full' : ''}">
					<div class="event-header">
						<div class="event-title">${event.name}</div>
						<div class="event-status ${isFull ? 'status-full' : 'status-available'}">
							${isFull ? 'VOL' : 'BESCHIKBAAR'}
						</div>
					</div>

					<div class="event-details">
						${event.description ? `<p style="margin-bottom: 15px; color: #7f8c8d;">${event.description}</p>` : ''}

						<div class="event-detail">
							<span><strong>👨‍🏫 Workshop Leider:</strong></span>
							<span>${event.workshopLeader}</span>
						</div>
						<div class="event-detail">
							<span><strong>📅 Datum:</strong></span>
							<span>${dateLabel}</span>
						</div>
						<div class="event-detail">
							<span><strong>⏱️ Rondes:</strong></span>
							<span>${roundsHtml}</span>
						</div>
						${event.location ? `
						<div class="event-detail">
							<span><strong>📍 Locatie:</strong></span>
							<span>${event.location}</span>
						</div>
						` : ''}
						<div class="event-detail">
							<span><strong>👥 Deelnemers:</strong></span>
							<span>${event.participants.length}/${event.maxParticipants}</span>
						</div>
					</div>

					${event.participants.length > 0 ? `
					<div class="participants-list">
						<strong>Aangemelde deelnemers:</strong>
						${event.participants.map(p => `
						<div class="participant-item">
							<div>
								<div><strong>${p.name}</strong> (${p.email})</div>
								<div class="participant-details">
									Studentnummer: ${p.studentNumber} | Opleiding: ${p.studentProgram}
								</div>
							</div>
							${this.currentUser && this.currentUser.role === 'admin' ? `
							<button class="remove-btn" onclick="eventManager.removeParticipant(${event.id}, '${p.email}')">❌</button>
							` : ''}
						</div>
						`).join('')}
					</div>
					` : ''}

					<!-- Admin actions -->
					${this.currentUser && this.currentUser.role === 'admin' ? `
					<div class="event-actions">
						<button title="Bewerk workshop" onclick="eventManager.copyEvent(${event.id})">✏️ Bewerken</button>
						<button onclick="eventManager.deleteEvent(${event.id})">🗑️ Verwijderen</button>
					</div>
					` : ''}
				</div>
			`;
		}).join('');
	}

	updateEventSelect() {
		const selectConfigs = [
			{ id: 'eventSelect', ronde: 1 },
			{ id: 'eventSelect2', ronde: 2 },
			{ id: 'eventSelect3', ronde: 3 }
		];

		// Read current selections to avoid showing the same event twice
		const currentSelections = selectConfigs.map(s => {
			const el = document.getElementById(s.id);
			return el ? el.value : '';
		}).filter(v => v);

		for (const cfg of selectConfigs) {
			const select = document.getElementById(cfg.id);
			if (!select) continue;

			const options = ['<option value="">-- Kies een workshop --</option>'];
			this.events.forEach(event => {
				if (event.participants.length >= event.maxParticipants) return; // skip full events
				if (!event.rounds || !event.rounds.some(r => parseInt(r.round) === cfg.ronde)) return; // skip events not in this ronde
				// don't show if already selected in another select
				if (currentSelections.includes(String(event.id)) && select.value !== String(event.id)) return;
				options.push(`<option value="${event.id}">${event.name} - ${event.workshopLeader} (${event.participants.length}/${event.maxParticipants})</option>`);
			});

			select.innerHTML = options.join('');
		}
	}


	updateStatistics() {
		const totalEvents = this.events.length;
		const totalParticipants = this.events.reduce((sum, event) => sum + event.participants.length, 0);
		const totalCapacity = this.events.reduce((sum, event) => sum + event.maxParticipants, 0);
		const fullEvents = this.events.filter(event => event.participants.length >= event.maxParticipants).length;
		const utilizationRate = totalCapacity > 0 ? Math.round((totalParticipants / totalCapacity) * 100) : 0;
		const uniqueStudents = new Set();
		this.events.forEach(event => {
			event.participants.forEach(p => uniqueStudents.add(p.email));
		});

		const statsGrid = document.getElementById('statsGrid');
		statsGrid.innerHTML = `
                    <div class="stat-card">
                        <div class="stat-number">${totalEvents}</div>
                        <div class="stat-label">Totaal Workshops</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${totalParticipants}</div>
                        <div class="stat-label">Totaal Aanmeldingen</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${uniqueStudents.size}</div>
                        <div class="stat-label">Unieke Studenten</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${totalCapacity}</div>
                        <div class="stat-label">Totale Capaciteit</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${fullEvents}</div>
                        <div class="stat-label">Volle Workshops</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${utilizationRate}%</div>
                        <div class="stat-label">Bezettingsgraad</div>
                    </div>
                `;
	}

	clearForm(formId) {
		document.getElementById(formId).reset();
	}

	showError(message) {
		const errorDiv = document.getElementById('errorMessage');
		const successDiv = document.getElementById('successMessage');
		errorDiv.textContent = message;
		errorDiv.style.display = 'block';
		successDiv.style.display = 'none';
		setTimeout(() => errorDiv.style.display = 'none', 5000);
	}

	showSuccess(message) {
		const successDiv = document.getElementById('successMessage');
		const errorDiv = document.getElementById('errorMessage');
		successDiv.textContent = message;
		successDiv.style.display = 'block';
		errorDiv.style.display = 'none';
		setTimeout(() => successDiv.style.display = 'none', 5000);
	}
}

// Initialize the EventManager
const eventManager = new EventManager();
















