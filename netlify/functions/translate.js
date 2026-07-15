export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { english, region } = JSON.parse(event.body || "{}");

    if (!english || typeof english !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Missing english phrase" })
      };
    }

    const regionMap = {
      mexican: "Mexican Spanish",
      colombian: "Colombian Spanish",
      spain: "Spain Spanish",
      neutral: "Neutral Spanish"
    };

    const regionLabel = regionMap[region] || "Neutral Spanish";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [
              "You translate English phrases into natural spoken Spanish.",
              `Use ${regionLabel}.`,
              "Return only compact JSON in this exact shape:",
              '{"english":"...","spanish":"...","region":"..."}'
            ].join(" ")
          },
          {
            role: "user",
            content: english
          }
        ]
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "OpenAI request failed", details })
      };
    }

    const data = await response.json();
    const raw =
      data.output_text ||
      data.output?.map(item =>
        (item.content || []).map(part => part.text || "").join("")
      ).join("") ||
      "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        english,
        spanish: raw.trim(),
        region: regionLabel
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        english: parsed.english || english,
        spanish: parsed.spanish || "",
        region: parsed.region || regionLabel
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "Server error",
        details: error.message
      })
    };
  }
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://YOUR_GITHUB_USERNAME.github.io",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
