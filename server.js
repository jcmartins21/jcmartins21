const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });
}

const equipment = parseCSV(path.join(__dirname, 'data', 'equipment.csv'));
const maintenance = parseCSV(path.join(__dirname, 'data', 'maintenance.csv'));

function buildEvents() {
  const events = [];
  equipment.forEach(eq => {
    const eqMaint = maintenance.filter(m => m.equipment_id === eq.id);
    eqMaint.forEach((m, idx) => {
      const start = new Date(eq.start_date);
      const date = new Date(start.getTime() + Number(m.days_after_start) * 24*60*60*1000);
      const id = `${eq.id}-${idx}`;
      events.push({
        id,
        equipment: eq.name,
        email: eq.email,
        task: m.task,
        date: date.toISOString().slice(0,10)
      });
    });
  });
  return events;
}

let events = buildEvents();

function sendReminders() {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7*24*60*60*1000);
  events.forEach(ev => {
    const evDate = new Date(ev.date);
    if (evDate >= now && evDate <= inSevenDays) {
      console.log(`Reminder: send email to ${ev.email} about ${ev.task} on ${ev.date}`);
    }
  });
}

setInterval(sendReminders, 24*60*60*1000); // daily
sendReminders();

function generateICS(event) {
  const dtstart = event.date.replace(/-/g, '') + 'T090000Z';
  return `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:${event.id}@planner\nDTSTAMP:${dtstart}\nDTSTART:${dtstart}\nSUMMARY:${event.equipment} - ${event.task}\nEND:VEVENT\nEND:VCALENDAR`;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  if (req.method === 'GET' && parsed.pathname === '/') {
    const index = fs.readFileSync(path.join(__dirname, 'public', 'index.html')); 
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(index);
  } else if (req.method === 'GET' && parsed.pathname === '/events') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(events));
  } else if (req.method === 'GET' && parsed.pathname === '/ics') {
    const ev = events.find(e => e.id === parsed.query.id);
    if (!ev) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {'Content-Type': 'text/calendar'});
    res.end(generateICS(ev));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
