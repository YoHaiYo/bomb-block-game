const gridSize = 8;
const grid = [];
const bombQueue = [];
let turn = 0;
let score = 0;
let gameOver = false;

function updateStatus() {
  $("#status").text(`Turn: ${turn} / Point: ${score}`);
}

function createGrid() {
  const $grid = $("#grid").empty();
  for (let y = 0; y < gridSize; y++) {
    grid[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const $cell = $(
        `<div class="cell bg-white border border-black text-center flex items-center justify-center cursor-pointer" data-x="${x}" data-y="${y}"></div>`
      );
      grid[y][x] = { bomb: null, obstacle: null, el: $cell };
      $grid.append($cell);
    }
  }
}

function updateObstacleStyle(cell) {
  // Tailwind 클래스 정리
  cell.el.removeClass((_, c) => (c.match(/bg-gray-[0-9]{3}/g) || []).join(" "));
  if (!cell.obstacle) return;
  const level = 400 + Math.min(cell.obstacle - 1, 5) * 100;
  cell.el.addClass(`obstacle bg-gray-${level}`);
}

function placeRandomObstacles(count = 1) {
  let attempts = 0;
  while (count > 0 && attempts < 100) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    const cell = grid[y][x];
    if (!cell.bomb && !cell.obstacle) {
      cell.obstacle = 1;
      cell.el.text(1);
      updateObstacleStyle(cell);
      count--;
    } else if (cell.obstacle) {
      cell.obstacle++;
      cell.el.text(cell.obstacle);
      updateObstacleStyle(cell);
      count--;
    }
    attempts++;
  }
}

function placeBomb(x, y) {
  const cell = grid[y][x];
  if (!cell.bomb && !cell.obstacle) {
    const bomb = { x, y, countdown: 3, power: 1, damage: 1 };
    cell.bomb = bomb;
    bombQueue.push(bomb);
    cell.el.text("3").addClass("bomb");
  }
}

function updateTurn() {
  turn++;
  // 0. 폭탄 카운트다운 감소 및 화면 업데이트
  bombQueue.forEach((bomb) => {
    bomb.countdown--;
    grid[bomb.y][bomb.x].el.text(bomb.countdown); // 👈 추가된 부분
  });

  // 1. 터질 폭탄들 모으기
  const toExplode = bombQueue.filter((b) => b.countdown <= 0);

  // 2. 연쇄 그룹 만들기
  const group = new Set();
  const queue = [...toExplode];

  while (queue.length > 0) {
    const b = queue.shift();
    const key = `${b.x},${b.y}`;
    if (group.has(key)) continue;

    group.add(key);

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    dirs.forEach(([dx, dy]) => {
      const nx = b.x + dx;
      const ny = b.y + dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) return;

      const neighbor = grid[ny][nx].bomb;
      if (neighbor && neighbor.countdown > 0) {
        neighbor.countdown = 0;
        queue.push(neighbor);
      }
    });
  }

  // 3. 데미지 = 연쇄 폭탄 개수
  const totalDamage = group.size;

  // 4. 그룹 내 폭탄들 실제 폭발
  group.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    explodeUniformDamage(x, y, totalDamage);
    grid[y][x].bomb = null;
    grid[y][x].el.text("").removeClass("bomb");
  });

  // 5. bombQueue 정리
  bombQueue.splice(
    0,
    bombQueue.length,
    ...bombQueue.filter((b) => b.countdown > 0)
  );

  // 6. 벽 생성 (3턴마다)
  if (turn % 3 === 0) {
    const newWallCount = Math.floor(turn / 3);
    placeRandomObstacles(newWallCount);
  }

  updateStatus();
  checkGameOver();
}

function explodeUniformDamage(x, y, damage) {
  showExplosion(x, y, damage);

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  dirs.forEach(([dx, dy]) => {
    for (let i = 1; i <= 1; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) break;

      const cell = grid[ny][nx];
      showExplosion(nx, ny, damage);

      if (cell.obstacle) {
        cell.obstacle -= damage;
        if (cell.obstacle <= 0) {
          score += 2;
          cell.obstacle = null;
          cell.el.text("").removeClass("obstacle");
        } else {
          score += 1;
          cell.el.text(cell.obstacle);
        }
        updateObstacleStyle(cell);
        break;
      }
    }
  });
}

function explodeBomb(bomb, toExplodeQueue) {
  const { x, y, power, damage } = bomb;
  const cell = grid[y][x];

  // 🧨 폭탄 제거
  cell.el.text("");
  cell.el.removeClass("bomb");
  cell.bomb = null;

  // 💥 폭탄 중심에 누적된 데미지 표시
  showExplosion(x, y, damage);

  // ➕ 폭발 범위 처리
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  dirs.forEach(([dx, dy]) => {
    for (let i = 1; i <= power; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) break;

      const target = grid[ny][nx];

      // 💥 데미지 표시
      showExplosion(nx, ny, damage);

      // 🧱 벽 처리에 실제 누적 데미지 반영
      if (target.obstacle) {
        target.obstacle -= damage;

        if (target.obstacle <= 0) {
          score += 2;
          target.obstacle = null;
          target.el.text("").removeClass("obstacle");
        } else {
          score += 1;
          target.el.text(target.obstacle);
        }

        updateObstacleStyle(target);
        break;
      }

      // 🔁 연쇄 폭발: 데미지 누적, power는 고정
      if (target.bomb && target.bomb.countdown > 0) {
        target.bomb.countdown = 0;
        toExplodeQueue.push({
          ...target.bomb,
          damage: damage + (target.damage || 1), // 데미지 누적 전파
        });
      }
    }
  });
}

function showExplosion(x, y, damage = 1) {
  const cell = grid[y][x];
  cell.el.text(damage);
  cell.el.addClass("explode");

  cell.el.one("animationend", () => {
    if (!cell.bomb && !cell.obstacle) {
      cell.el.text("");
    }
    cell.el.removeClass("explode");
  });
}

function checkGameOver() {
  const hasEmpty = grid.flat().some((c) => !c.bomb && !c.obstacle);
  if (!hasEmpty) {
    gameOver = true;
    $("#overlay").removeClass("hidden");
  }
}

$("#grid").on("click", ".cell", function () {
  if (gameOver) return;

  const x = parseInt($(this).data("x"));
  const y = parseInt($(this).data("y"));
  const cell = grid[y][x];
  if (cell.bomb || cell.obstacle) return;

  placeBomb(x, y);
  updateTurn();
});

createGrid();
placeRandomObstacles(10);
updateStatus();
