class EventManager {
	constructor() {
		this.events = [];
		this.participants = new Map(); // email -> [eventIds] mapping
		this.eventIdCounter = 1;
		this.currentUser = null;
		this.adminPassword = 'admin123'; // In productie zou dit veiliger moeten zijn
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
		const password = document.getElementById('adminPassword').value;
		if (password === this.adminPassword) {
			this.currentUser = { role: 'admin' };
			this.showInterface();
		} else {
			alert('Incorrect wachtwoord!');
		}
	}

	logout() {
		this.currentUser = null;
		document.getElementById('authPanel').style.display = 'block';
		document.getElementById('userInfo').style.display = 'none';
		document.getElementById('adminPanel').style.display = 'none';
		document.getElementById('registrationForm').style.display = 'none';
		document.getElementById('adminLogin').style.display = 'none';
		document.getElementById('adminPassword').value = '';
	}

	showInterface() {
		document.getElementById('authPanel').style.display = 'none';
		document.getElementById('userInfo').style.display = 'flex';

		const roleText = this.currentUser.role === 'admin' ? '👨‍💼 Administrator' : '👨‍🎓 Student';
		document.getElementById('userRole').textContent = roleText;

		if (this.currentUser.role === 'admin') {
			document.getElementById('adminPanel').style.display = 'block';
			document.getElementById('statisticsPanel').style.display = 'block';
		} else {
			document.getElementById('registrationForm').style.display = 'block';
			document.getElementById('statisticsPanel').style.display = 'none';
		}

		this.updateDisplay();
	}

	async loadData() {
		try {
			const resp = await fetch(`${this.apiBase}/data.php`);
			if (!resp.ok) throw new Error('Server returned ' + resp.status);
			const data = await resp.json();
			this.events = data.events || [];
			this.eventIdCounter = data.eventIdCounter || (this.events.reduce((m,e)=>Math.max(m,e.id||0),0) + 1) || 1;
			const parts = data.participants || {};
			this.participants = new Map(Object.entries(parts).map(([k,v]) => [k, v]));
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

			const resp = await fetch(`${this.apiBase}/data.php`, {
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
		const startTime = document.getElementById('startTime').value;
		const endTime = document.getElementById('endTime').value;
		const maxParticipants = parseInt(document.getElementById('maxParticipants').value);
		const location = document.getElementById('location').value;
		// collect rounds from admin checkboxes (.roundCheckbox added in index.html)
		const roundCheckboxes = Array.from(document.querySelectorAll('.roundCheckbox'));
		const rounds = roundCheckboxes.filter(cb => cb.checked).map(cb => parseInt(cb.value));

		if (rounds.length === 0) {
			this.showError('Selecteer minimaal één ronde voor de workshop.');
			return;
		}

		if (new Date(startTime) >= new Date(endTime)) {
			this.showError('Eindtijd moet na de starttijd zijn!');
			return;
		}

		const event = {
			id: this.eventIdCounter++,
			name,
			description,
			workshopLeader,
			startTime,
			endTime,
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
		const email = document.getElementById('participantEmail').value;
		const studentNumber = parseInt(document.getElementById('studentNumber').value);
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

		const selectedIds = selectedMap.map(s => parseInt(s.value));
		const uniqueEventIds = [...new Set(selectedIds)];

		// Validate Ter AA email: must be digits (student id) before @ and domain roc-teraa.nl or ter-aa.nl
		const studentNumberStr = String(studentNumber);
		const terAaRegex = new RegExp(`^${studentNumberStr}@(roc-)?ter-aa\\.nl$`, 'i');
		if (!terAaRegex.test(email)) {
			this.showError('Gebruik je Ter AA e-mailadres: bijvoorbeeld 12345@roc-teraa.nl of 98765@ter-aa.nl. Het gedeelte vóór @ moet je leerlingnummer zijn.');
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

			const event = this.events.find(e => e.id === eventId);
			if (!event) {
				this.showError(`Event met ID ${eventId} niet gevonden!`);
				return;
			}

			if (event.participants.length >= event.maxParticipants) {
				this.showError(`Event "${event.name}" is vol!`);
				return;
			}

			// Ensure the event includes the requested ronde
			if (!event.rounds || !event.rounds.includes(requestedRonde)) {
				this.showError(`Event "${event.name}" is niet beschikbaar in Ronde ${requestedRonde}.`);
				return;
			}

			const parseDate = (timeStr) => new Date(timeStr);

			// Compare start times to detect scheduling conflicts (minimal check). Events store startTime/endTime.
			const hasTimeConflict = currentEvents.some(id => {
				const e = this.events.find(ev => ev.id === id);
				return e && parseDate(e.startTime).getTime() === parseDate(event.startTime).getTime();
			}) || newEvents.some(e => parseDate(e.event.startTime).getTime() === parseDate(event.startTime).getTime());

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
			entry.event.participants.push(participant);
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
			const resp = await fetch(`${this.apiBase}/send-confirmation.php`, {
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
		let csv = 'Event Naam,Beschrijving,Workshop Leider,Starttijd,Eindtijd,Locatie,Rondes,Maximum Deelnemers,Aantal Aanmeldingen,Deelnemer Naam,Email,Leerlingnummer,Opleiding,Aanmelddatum\n';

		this.events.forEach(event => {
			const roundsStr = event.rounds ? event.rounds.join('|') : '';
			const baseInfo = `"${event.name}","${event.description}","${event.workshopLeader}","${event.startTime}","${event.endTime}","${event.location}","${roundsStr}",${event.maxParticipants},${event.participants.length}`;

			if (event.participants.length === 0) {
				csv += baseInfo + ',,,,,\n';
			} else {
				event.participants.forEach(participant => {
					csv += baseInfo + `,"${participant.name}","${participant.email}",${participant.studentNumber},"${participant.studentProgram}","${participant.registeredAt.toLocaleString('nl-NL')}"\n`;
				});
			}
		});

		this.downloadFile(csv, 'events-export.csv', 'text/csv');
	}

	exportToExcel() {
		// Simple HTML table format that Excel can open
		let html = '<table border="1">';
		html += '<tr><th>Event Naam</th><th>Beschrijving</th><th>Workshop Leider</th><th>Starttijd</th><th>Eindtijd</th><th>Locatie</th><th>Rondes</th><th>Max Deelnemers</th><th>Aantal Aanmeldingen</th><th>Deelnemer Naam</th><th>Email</th><th>Leerlingnummer</th><th>Opleiding</th><th>Aanmelddatum</th></tr>';

		this.events.forEach(event => {
			const roundsStr = event.rounds ? event.rounds.join('|') : '';
			const baseInfo = `<td>${event.name}</td><td>${event.description}</td><td>${event.workshopLeader}</td><td>${event.startTime}</td><td>${event.endTime}</td><td>${event.location}</td><td>${roundsStr}</td><td>${event.maxParticipants}</td><td>${event.participants.length}</td>`;

			if (event.participants.length === 0) {
				html += '<tr>' + baseInfo + '<td></td><td></td><td></td><td></td><td></td></tr>';
			} else {
				event.participants.forEach(participant => {
					html += '<tr>' + baseInfo + `<td>${participant.name}</td><td>${participant.email}</td><td>${participant.studentNumber}</td><td>${participant.studentProgram}</td><td>${participant.registeredAt.toLocaleString('nl-NL')}</td></tr>`;
				});
			}
		});

		html += '</table>';
		this.downloadFile(html, 'events-export.xls', 'application/vnd.ms-excel');
	}

	downloadFile(content, filename, contentType) {
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
				cb.checked = eventToCopy.rounds ? eventToCopy.rounds.includes(parseInt(cb.value)) : false;
			});

			// Reset dates so the admin *must* pick new ones
			document.getElementById('startTime').value = '';
			document.getElementById('endTime').value = '';

			this.showSuccess('Workshop gegevens gekopieerd naar het formulier. Pas de datum/tijd aan en klik op toevoegen!');
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
			const startDate = new Date(event.startTime);
			const endDate = new Date(event.endTime);
			const roundsLabel = event.rounds ? event.rounds.join(', ') : '-';

			return `
				<div class="event-card ${isFull ? 'full' : ''}">
					<div class="event-header">
						<div class="event-title">${event.name} (Rondes ${roundsLabel})</div>
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
							<span><strong>📅 Start:</strong></span>
							<span>${startDate.toLocaleString('nl-NL')}</span>
						</div>
						<div class="event-detail">
							<span><strong>⏰ Eind:</strong></span>
							<span>${endDate.toLocaleString('nl-NL')}</span>
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
									Leerlingnummer: ${p.studentNumber} | Opleiding: ${p.studentProgram}
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
						<button onclick="eventManager.copyEvent(${event.id})">📋 Kopiëren</button>
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
				if (!event.rounds || !event.rounds.includes(cfg.ronde)) return; // skip events not in this ronde
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