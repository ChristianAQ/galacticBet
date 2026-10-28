import { competitionName } from "./competitions";
import { euro, porraTotal, type Porra } from "./porra";

/** A local, complete PNG with no remote assets or canvas-tainting image requests. */
export async function porraImage(p: Porra): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no ha podido preparar la imagen.");
  const width = 1000,
    twoColumns = p.players.length > 8,
    columns = twoColumns ? 2 : 1;
  const colWidth = (width - 112 - (twoColumns ? 20 : 0)) / columns;
  function font(size: number, weight = 500) {
    ctx!.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
  }
  function lines(value: string, maxWidth: number) {
    const result: string[] = [];
    let current = "";
    for (const char of Array.from(value)) {
      if (current && ctx!.measureText(current + char).width > maxWidth) {
        result.push(current.trim());
        current = char;
      } else current += char;
    }
    if (current) result.push(current.trim());
    return result;
  }
  const playerFont = twoColumns ? 26 : 34;
  const playerLine = twoColumns ? 32 : 40;
  const nameWidth = colWidth - (twoColumns ? 180 : 220);
  font(playerFont, 600);
  const rowHeights = Array.from(
    { length: Math.ceil(p.players.length / columns) },
    (_, row) =>
      Math.max(
        ...p.players
          .slice(row * columns, row * columns + columns)
          .map((player) =>
            Math.max(
              twoColumns ? 74 : 88,
              lines(player.name, nameWidth).length * playerLine + 24,
            ),
          ),
      ),
  );
  font(36, 750);
  const titleLines = lines(p.title, 880);
  font(30, 650);
  const homeLines = lines(p.fixture.home, 365),
    awayLines = lines(p.fixture.away, 365);
  const headingHeight =
    374 +
    titleLines.length * 44 +
    Math.max(homeLines.length, awayLines.length) * 36;
  const height =
    headingHeight + rowHeights.reduce((sum, size) => sum + size + 10, 0) + 205;
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#eef4ed";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";
  function write(
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#173b2d",
    weight = 500,
  ) {
    font(size, weight);
    ctx!.fillStyle = color;
    ctx!.fillText(value, x, y);
  }
  function box(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    radius = 16,
  ) {
    ctx!.beginPath();
    ctx!.roundRect(x, y, w, h, radius);
    ctx!.fillStyle = color;
    ctx!.fill();
  }
  write("galacticbet / PORRA", 56, 42, 23, "#37694f", 750);
  write(
    p.demo ? "DEMO · PARTIDO DE EJEMPLO" : "ENTRE AMIGOS",
    56,
    88,
    16,
    "#6b7c6d",
    650,
  );
  titleLines.forEach((line, i) =>
    write(line, 56, 130 + i * 44, 36, "#173b2d", 750),
  );
  const fixtureY = 152 + titleLines.length * 44;
  const competition = competitionName(p.fixture.competition);
  write(competition, 56, fixtureY, 19, "#587260", 600);
  const teamsY = fixtureY + 48;
  box(56, teamsY, 74, 74, "#dce9d8", 37);
  box(870, teamsY, 74, 74, "#dce9d8", 37);
  write(
    p.fixture.home.slice(0, 2).toUpperCase(),
    71,
    teamsY + 23,
    24,
    "#315840",
    750,
  );
  write(
    p.fixture.away.slice(0, 2).toUpperCase(),
    885,
    teamsY + 23,
    24,
    "#315840",
    750,
  );
  homeLines.forEach((line, i) =>
    write(line, 56, teamsY + 93 + i * 36, 30, "#173b2d", 650),
  );
  awayLines.forEach((line, i) => {
    font(30, 650);
    write(
      line,
      944 - ctx.measureText(line).width,
      teamsY + 93 + i * 36,
      30,
      "#173b2d",
      650,
    );
  });
  write("vs", 485, teamsY + 25, 23, "#81917e");
  const dateY =
    teamsY + 110 + Math.max(homeLines.length, awayLines.length) * 36;
  write(
    new Intl.DateTimeFormat("es", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(p.fixture.utcDate)),
    56,
    dateY,
    20,
    "#587260",
  );
  let rowY = headingHeight;
  p.players.forEach((player, i) => {
    const col = i % columns,
      row = Math.floor(i / columns),
      x = 56 + col * (colWidth + 20),
      rowH = rowHeights[row];
    box(x, rowY, colWidth, rowH, "#ffffff");
    font(playerFont, 600);
    const nameLines = lines(player.name, nameWidth);
    const nameY = rowY + (rowH - nameLines.length * playerLine) / 2;
    nameLines.forEach((line, j) =>
      write(line, x + 18, nameY + j * playerLine, playerFont, "#173b2d", 600),
    );
    const pillWidth = twoColumns ? 123 : 160;
    const scoreSize = twoColumns ? 27 : 34;
    box(
      x + colWidth - pillWidth - 18,
      rowY + (rowH - 48) / 2,
      pillWidth,
      48,
      "#dce9d8",
      10,
    );
    const score = `${player.home} – ${player.away}`;
    font(scoreSize, 750);
    write(
      score,
      x + colWidth - 18 - pillWidth / 2 - ctx.measureText(score).width / 2,
      rowY + (rowH - scoreSize) / 2,
      scoreSize,
      "#244a34",
      750,
    );
    if (col === columns - 1 || i === p.players.length - 1) rowY += rowH + 10;
  });
  box(56, rowY + 14, 888, 112, "#173b2d");
  write(
    `${p.players.length} personas · ${euro(p.contributionCents)} por persona`,
    78,
    rowY + 37,
    21,
    "#d9e7d3",
    500,
  );
  write("BOTE TOTAL", 78, rowY + 78, 16, "#c7d8bf", 650);
  const total = euro(porraTotal(p));
  font(40, 750);
  write(
    total,
    921 - ctx.measureText(total).width,
    rowY + 64,
    40,
    "#f1edc6",
    750,
  );
  write(
    "GalacticBet · Marcador a 90 minutos · Aportaciones anotadas",
    56,
    rowY + 151,
    17,
    "#667b69",
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo crear la imagen.")),
      "image/png",
    ),
  );
}
