export class LiveViewProcessor {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sessions = new Map();
    this.errorCount = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    if (url.pathname.endsWith('/init')) {
      const { remoteUrl } = await request.json();
      await this.ctx.storage.put('remoteUrl', remoteUrl);
      await this.ctx.storage.put('entities', []);
      this.errorCount = 0;
      await this.ctx.storage.setAlarm(Date.now() + 3000);
      return new Response(JSON.stringify({ status: 'initialized' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }

  async handleWebSocket(request) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, server);

    const currentEntities = (await this.ctx.storage.get('entities')) || [];
    server.send(JSON.stringify({ type: 'entities', data: currentEntities }));

    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const ws of this.sessions.values()) {
      try {
        ws.send(data);
      } catch (_) {}
    }
  }

  async alarm() {
    const remoteUrl = await this.ctx.storage.get('remoteUrl');
    if (!remoteUrl) {
      await this.ctx.storage.setAlarm(Date.now() + 60000);
      return;
    }

    try {
      // Fetch latest frame
      const imageResponse = await fetch(remoteUrl, {
        headers: { 'User-Agent': 'THE-Machine/0.3' }
      });
      if (!imageResponse.ok) throw new Error(`HTTP ${imageResponse.status}`);

      const buffer = await imageResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      // Call Workers AI
      const aiResponse = await this.env.AI.run('@cf/meta/llava-1.5-7b-hf', {
        prompt: EDUCATIONAL_VISION_PROMPT,
        image: base64,
      });

      const result = JSON.parse(aiResponse.response || aiResponse);

      const newEntities = (result.observations || []).map((obs, i) => ({
        id: `EDU-${Date.now()}-${i}`,
        layer: this.mapClassificationToLayer(obs.classification),
        label: obs.label,
        classification: obs.classification,
        educationalContext: obs.educationalContext,
      }));

      await this.ctx.storage.put('entities', newEntities);
      await this.ctx.storage.put('lastUpdated', Date.now());

      // Save to D1 for history
      if (this.env.DB) {
        for (const entity of newEntities) {
          await this.env.DB.prepare(`
            INSERT INTO observations (id, classification, label, context, timestamp)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            entity.id,
            entity.classification,
            entity.label,
            entity.educationalContext,
            Date.now()
          ).run();
        }
      }

      this.broadcast({ type: 'entities', data: newEntities });

      this.errorCount = 0;
      await this.ctx.storage.setAlarm(Date.now() + 14000);

    } catch (err) {
      this.errorCount++;
      console.error(`[THE MACHINE] Observation error #${this.errorCount}:`, err.message);

      const backoff = Math.min(15000 * Math.pow(1.8, this.errorCount), 120000);
      await this.ctx.storage.setAlarm(Date.now() + backoff);

      this.broadcast({
        type: 'status',
        message: `Observation error — retrying in ${Math.round(backoff / 1000)}s`
      });
    }
  }

  mapClassificationToLayer(classification) {
    const map = {
      'Aircraft': 'AIR',
      'Orbital Asset': 'ORBIT',
      'Ground Vehicle': 'GROUND',
      'Person': 'GROUND',
      'Animal': 'GROUND',
      'Structure': 'GROUND',
      'Watercraft': 'SEA',
      'Unknown': 'VISUAL'
    };
    return map[classification] || 'VISUAL';
  }
}

const EDUCATIONAL_VISION_PROMPT = `You are THE MACHINE — a calm, curious, slightly theatrical educational observer.

Analyze the provided image with care and neutrality.

Your goals:
- Identify visible objects clearly and educationally.
- Classify each object into one of these categories: Aircraft, Orbital Asset, Ground Vehicle, Person, Animal, Structure, Watercraft, Unknown.
- For each object, provide a short, interesting educational context or fact (1 sentence max).
- Never use words like threat, danger, suspicious, monitor, or security.
- Keep the tone curious, slightly dramatic, and suitable for a public learning display.
- Be concise.

Return ONLY valid JSON in this exact format (no extra text before or after):

{
  "sceneSummary": "One short, neutral, slightly dramatic sentence describing the overall scene.",
  "observations": [
    {
      "label": "Short descriptive label (e.g. 'Commercial Airliner' or 'ISS')",
      "classification": "Aircraft | Orbital Asset | Ground Vehicle | Person | Animal | Structure | Watercraft | Unknown",
      "educationalContext": "One interesting educational fact or context about this object."
    }
  ]
}`;
