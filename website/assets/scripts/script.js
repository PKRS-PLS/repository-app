//configs
let tick = 100; //un tick normal pour un snake
let score = 0; //score
let mangee = 0; //nombre de food mangé
let direction_applied = false; //to prevent snake to turn on himself
let debug_mode = false; //pour eviter de faire trop de call à l'api qui est limité a 10k req/month
let styles = ["new", "old"];
let current_style = styles[0];
let T1 = 0;
let score_in_time = [[score,mangee,T1]]; //score et mange en fonction du temps
let username = "inconnu";
let pause = false;
let pause_time = 0;
let indicate_food_index = 0; //permet de réduire l'opacity d'un "fruit" avec une meilleurs fréquence (1ms au lieu de 100)
let FLAGSNAKE = false;//pour avoir un snake qui représente certain drapeaux
function config_sound(s = "", config = {}) {
  let sound = new Audio(s);
  if ("pitch_modif" in config && config["pitch_modif"]) {
    sound.preservesPitch = false; //on "config" le son, bon en réalité on met un pitch aléatoire entre 0.8 et 1.3, ça diversifie les sons
    sound.playbackRate = 0.8 + Math.random() / 2; //un better sound design
  }
  for (var i in config) {
    if (i == "pithc_modif") {
      continue;
    }
    sound[i] = config[i];
  }
  return sound.play(); //+ le fait de créer et de jouer le son dans une fonction permet de répéter le son plusieurs fois
}

let soundboard = {
  //un dictionnaire de sons pour les appeler plus facilement
  gameOver: () => {
    config_sound("assets/sounds/gameover.mp3");
  },
  eat: () => {
    config_sound("assets/sounds/chewum.wav", { pitch_modif: true });
  },
  score: () => {
    config_sound("assets/sounds/coin.wav");
  },
  teleport: () => {
    config_sound("assets/sounds/teleport.mp3", {
      pitch_modif: true,
      volume: 0.2,
    });
  },
};
let canvas = document.createElement("canvas");
canvas.width = document.body.offsetWidth;
canvas.height = screen.height - 78;
let ctx = canvas.getContext("2d");
let box = 32;
let max_box = [Math.floor(canvas.width / box) - 1, Math.floor(canvas.height / box) - 1]; //les bordures
function sort_dict(d) {
  var items = Object.keys(d)
    .map((key) => {
      return [key, d[key]];
    }) //on prends clef:value
    .sort((a, b) => {
      return b[1]["score"] - a[1]["score"];
    }) //on trie en fonction du score
    .map((a) => {
      return a[1];
    }); //on renvoi seulement (dans une liste) les elements dans l'ordres
  return items;
}

function make_request(callback = console.log,method = "GET",data = null,sorted = true) {
  //fonction pour faire des requetes à l'api
  if (debug_mode) {
    console.log("requesting", method, data);
    if (method == "GET") {
      data = [
        //sample value I got from the real db
        {
          _id: "64382fa88e4844160002778f",
          name: "Ender",
          score: 49,
          timestamp: 1681576337347,
          delta_time: 108724,
        },
        {
          _id: "6438386d8e48441600027bbb",
          name: "Test",
          score: 189,
          timestamp: 1681584084680,
          delta_time: 87628,
        },
      ];
    }
    return callback(sort_dict(data));
  }
  var xhr = new XMLHttpRequest();
  xhr.withCredentials = false;
  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      let data = JSON.parse(this.responseText);
      if (callback) {
        callback(sorted ? sort_dict(data) : data);
      }
    }
  });
  method_need_id = method == "DELETE" || method == "PUT";
  method_need_data = method == "POST" || method == "PUT";
  xhr.open(
    method,
    "https://snake-bb5d.restdb.io/rest/dataset" +
      (method_need_id ? "/" + (method_need_data ? data["_id"] : data) : "")
  ); //method is delete or put, add id to url (if put get _id from obj)
  xhr.setRequestHeader("content-type", "application/json");
  xhr.setRequestHeader("x-apikey", "64382ef839cf552ef728c217"); //plz don't share lol
  xhr.setRequestHeader("cache-control", "no-cache");
  xhr.send(method_need_data ? JSON.stringify(data) : null); //if method is post or put then we send obj in string
}

let localbest = {};
make_request((a) => {
  localbest = a;
}); //init local best scores

/*function dchiffre(n = 5, w) {//ancient version for local storage system
  x = w;
  for (var i = 0; i < n; i++) {
    x = atob(x);
  }
  return x;
}
function chiffre(w,n = 5) {
  x = w;
  for (var i = 0; i < n; i++) {
    x = btoa(x);
  }
  return x;
}*/

function getRndCoords() {
  return {
    x: Math.floor(Math.random() * max_box[0]) * box, //génère des coordonnées aléatoire valide (sur la grille)
    y: Math.floor(Math.random() * max_box[1]) * box,
  };
}
function getNearRndCoords() {
  rnd_bool = Math.random() > 0.5;
  return {
    x: me[0].x + Math.abs(Math.floor(Math.random() * 7) * (rnd_bool ? -box : box)),
    y: me[0].y + Math.abs(Math.floor(Math.random() * 7) * (rnd_bool ? -box : box)), //to teleport in a 5x5 box area (including -7x-7) around the player head
  };
}
let me = [
  {
    x: box * Math.floor(Math.random() * 4 + 10),
    y: box * Math.floor(Math.random() * 4 + 9),
  },
];
me.push({
  x: me[0].x,
  y: me[0].y + 1,
});
let game;
let food_display;
let current_direction = "";

function pause_screen_switch(){
  let pause_screen = document.querySelector(".pause_screen");
  if(!pause){
    pause_screen.classList.add("active");
  }else{
    pause_screen.classList.remove("active");
  }
}

function update_pausescreen(){
  let pause_screen = document.querySelector(".pause_screen");
  pause_screen.querySelector(".time").innerHTML = format_t(T1?Date.now() - T1:0);
  pause_screen.querySelector(".score").innerHTML = score;
  //create a chart with the score and delta time (line chart) with food eaten (mangee variable) over time (x axis)
  //there is a variable (score_in_time) with [score,mange,temps] for each food eaten
  create_local_stat_chart();
}
function create_local_stat_chart(context="locale"){
  let b4chart = Chart.getChart("statistique_"+context);
  if(b4chart){b4chart.destroy();}
  let ctx = document.querySelector("#statistique_"+context).getContext("2d");
  let chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: score_in_time.map((a) => {
        return format_t(a[2]);
      }
      ),
      datasets: [
        {
          label: "Score",
          data: score_in_time.map((a) => {
            return a[0];
          }
          ),
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        },
        {
          label: "Food eaten",
          data: score_in_time.map((a) => {
            return a[1];
          }
          ),
          backgroundColor: "rgba(99, 255, 132, 0.2)",
          borderColor: "rgba(99, 255, 132, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
        },
      },
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  });
}

function pause_or_resume(e) {//function pour mettre en pause ou reprendre le jeu
  if (!pause) {
    window.cancelAnimationFrame(game);
    window.cancelAnimationFrame(food_display);
    update_pausescreen();
    pause_time = Date.now();
  } else {
    T1 += Date.now() - pause_time;//adding the time the game was paused to the time the game started (T1)
    for(var i in foods){
      var food = foods[i];
      if("capacity" in food){
        foods[i]["capacity"][1] += Date.now() - pause_time;
      }
    }
    game = window.requestAnimationFrame(draw);
    food_display = window.requestAnimationFrame(food_main);
  }
  pause_screen_switch();
  pause = !pause;
}

function html_change() {
  //change the html to display the score and the best score
  document.body.appendChild(canvas);
  canvas.className = "snake";
  let pause_screen = document.createElement("div");
  pause_screen.className = "pause_screen";
  pause_screen.innerHTML = `<h1>Pause</h1>
  <p>Temps: <span class="time">temps</span>
  Score: <span class="score">${score}</span>
  Meilleur score: <span class="best_score">${localbest[0].score}</span></p>
  <div class="stats_paused">
    <canvas id="statistique_locale"></canvas>
  </div>
  <button class='reprendre'>Reprendre</button>`;
  document.body.appendChild(pause_screen);
  document.querySelector(".reprendre").addEventListener("click",pause_or_resume,true);
  let buttons_div = document.createElement("div");
  let change_style_bouton = document.createElement("button");
  let pause_bouton = document.createElement("button");
  change_style_bouton.innerHTML = "Changer de style";
  pause_bouton.innerHTML = "Pause";
  pause_bouton.addEventListener("click",pause_or_resume,true);
  pause_bouton.className = "pause_bouton";
  buttons_div.className = "buttons_div";
  buttons_div.appendChild(pause_bouton);
  change_style_bouton.onclick = function () {
    if (current_style == "new") {
      current_style = "old";
      change_style_bouton.classList.add("old");
      canvas.style.background =
        "linear-gradient(45deg, rgb(120 212 255)20%, rgb(86 96 196), rgb(169 97 251))";
    } else {
      current_style = "new";
      change_style_bouton.classList.remove("old");
      canvas.style.background = "";
    }
  };
  buttons_div.appendChild(change_style_bouton);
  document.body.appendChild(buttons_div);
  change_style_bouton.className = "change_style_bouton";
}

//functions
async function play(reset = false) {
  //fonction qui permet de jouer
  document.body.style.setProperty("overflow-y", "hidden");
  Swal.fire({//créer une popup pour demander le pseudo
    title: "Entrez votre pseudo",
    input: "text",
    inputAttributes: {
      autocapitalize: "off",
    },
    showCancelButton: true,
    cancelButtonText: "Annuler",
    confirmButtonText: "Jouer",
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
  }).then((result) => {
    if (result.value.length < 3 || result.value.length > 10) {
      return alert("Le pseudo doit faire entre 3 et 10 caractères");
    }
    username = result.value || "inconnu";
    if (!reset) {
      html_change();
    }
    document.addEventListener("keydown", direction);
    game = window.requestAnimationFrame(draw); //normaly tick in setInterval 1000 / (fps + score / 5)
    food_display = window.requestAnimationFrame(food_main);
  });
}
function format_t(delta_time=(Date.now()-T1)) {
  //credit : stackoverflow -> https://stackoverflow.com/questions/19700283/how-to-convert-time-in-milliseconds-to-hours-min-sec-format-in-javascript
  var milliseconds = Math.floor((delta_time % 1000) / 100),
    seconds = Math.floor((delta_time / 1000) % 60),
    minutes = Math.floor((delta_time / (1000 * 60)) % 60),
    hours = Math.floor((delta_time / (1000 * 60 * 60)) % 24);

  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;

  return hours + "h" + minutes + " et " + seconds + "." + milliseconds + " sec";
}


function showStats(context="globale"){
  //fonction permettant d'afficher les statistiques
  // document.querySelector(".game").remove();
  let board = document.createElement("div");
  var lc = context=="me";
  board.className = lc?"now_stats":"stats";
  board.innerHTML = `<canvas id='statistique_globale'></canvas><button>X</button>`;
  // if(lc){
  //   board.querySelector("canvas").id="statistique_globale";
  // }
  document.body.appendChild(board);
  board.querySelector("button").addEventListener("click",function(){
    board.remove();
    input_list = [];
  },true);
  var ctx = board.querySelector("canvas").getContext('2d');
  // function reformat(d){
  //   a  =(new Date(d)).toLocaleDateString().replace(/\/[0-9]{4}/g,"");
  //   return a+ " " + (new Date(d)).toLocaleTimeString();
  // }
  //console.log(context);
  if(context=="globale"){
  Chart.defaults.color = '#000';
  var myChart = new Chart(ctx, {
    type: 'pie',
    data: {
        labels: localbest.map(e=>e["name"]),
        datasets: [{
            label: 'score',
            data: localbest.map(e=>e["score"]),
            backgroundColor: localbest.map((e,i)=>colors[i]),
            borderColor: localbest.map((e,i)=>colors[i]),
            borderWidth: 1
        }]
    },
    options: {
      title: {
        display: true,
        text: 'Top 10'
      },
    }
  });
  }else{
    create_local_stat_chart("globale");
  }
}

function gameOver() {
  //function permettant de finir la partie et d'afficher le score et le temps de jeu et de demander si on veut rejouer ou non
  let delta_time = Date.now() - T1;
  soundboard["gameOver"]();
  make_request(function (localbest) {
    let localbest_names = {};
    localbest.forEach(function (e) {
      return (localbest_names[e["name"]] = e);
    }); //for affichage and functionnal purposes
    if (localbest.length < 10 || localbest[localbest.length - 1] < score) {
      //compare to the lowest score in top 10
      let user_already_in = username in localbest_names;
      if (!user_already_in) {
        let created_obj = {
          name: username,
          score: score,
          timestamp: Date.now(),
          delta_time: delta_time,
        }; //on creer un obj json (dict dans python)
        localbest.push(created_obj);
        while (localbest.length > 10) {
          //while au cas ou (sait on jamais une corruption / bug)
          let last = localbest[localbest.length - 1]; //store for line +2
          localbest.pop(); //delete last scores
          make_request(() => {}, "DELETE", last["_id"]); //to delete we need _id and not id
        }
        make_request(() => {}, "POST", created_obj);
      } else if (localbest_names[username]["score"] < score) {
        //update score if higher than before
        let update_obj = {
          score: score,
          _id: localbest_names[username]["_id"],
          delta_time: delta_time,
          timestamp: Date.now(),
        }; //on créer un obj pour update
        localbest_names[username] = update_obj;
        make_request(() => {}, "PUT", update_obj);
      }
      localbest = sort_dict(localbest);
    }
    var contain = document.createElement("div");
    var titre = document.createElement("h1");
    titre.innerText = "Game Over";
    titre.className = "titre";
    var p = document.createElement("p");
    p.innerHTML = "Votre score est " + score + "<br>" + "LeaderBoard:";
    for (var i in localbest_names) {
      p.innerHTML += `<br>- ${i} : ${
        localbest_names[i]["score"]
      } | temps: ${format_t(localbest_names[i]["delta_time"])}`;
    }
    let button_div = document.createElement("div");
    button_div.className = "button_div";
    let reset_btn = document.createElement("button");
    let stat_board = document.createElement("button");
    let mes_stats = document.createElement("button");
    stat_board.innerText = "statistiques global";
    mes_stats.innerText = "mes statistiques";
    reset_btn.innerText = "reset";
    reset_btn.className = "reset_button";
    stat_board.className = "stat_button";
    mes_stats.className = "mes_stat_button";
    reset_btn.addEventListener("click",function () {
        document.querySelector(".game").remove();
        score = 0;
        mangee = 0;
        T1 = 0;
        foods = [getNearRndCoords()];
        score_in_time = [0,0,0];
        me = [
          {
            x: box * Math.floor(Math.random() * 4 + 10),
            y: box * Math.floor(Math.random() * 4 + 9),
          },
        ];
        me.push({
          x: me[0].x,
          y: me[0].y + 1,
        });
        current_direction = "";
        play(true);
      },true);
      
    mes_stats.addEventListener("click",()=>{showStats("me");},true);
    stat_board.addEventListener("click",()=>{showStats();},true);
    contain.appendChild(titre);
    contain.appendChild(p);
    contain.appendChild(button_div);
    button_div.appendChild(mes_stats);
    button_div.appendChild(stat_board);
    button_div.appendChild(reset_btn);
    contain.className = "game";
    document.body.appendChild(contain);
  });
}
//quelques variables de base
let foods = [getRndCoords()];
let colors = [
  "#ff4e4e",
  "#53ff95",
  "#4545ff",
  "#6b30ff",
  "#fffe30",
  "#ffffff",
  "#5afff7",
];
const capacity = [
  null,
  { score: 2 },
  {
    score: 3,
    action: ["teleport", 15 * 1000],
  },
  {
    score: 5,
    action: ["teleport", 7000],
  },
  {
    score: 7,
    action: ["teleport", 3000, "near"],
  },
  {
    score: 10,
    action: ["disapear", 5000],
  },
  {
    score: 15,
    action: ["teleport_snake", 0],
  },
];

function direction(event) {//fonction qui permet de changer la direction du serpent
  if (current_direction == "") {
    T1 = Date.now();
  }
  if (!direction_applied) {
    return;
  } //doing this also because this is on 60 frame and not on 60/4 frame
  let key = event.keyCode;
  if (key == 37 && current_direction != "droite") {
    current_direction = "gauche";
  } else if (key == 38 && current_direction != "bas") {
    current_direction = "haut";
  } else if (key == 39 && current_direction != "gauche") {
    current_direction = "droite";
  } else if (key == 40 && current_direction != "haut") {
    current_direction = "bas";
  }
  direction_applied = false;
}

function collision(head, array) {//fonction qui permet de savoir si le serpent se mange lui meme
  for (let i = 1; i < array.length; i++) {
    for (var j in foods) {
      var food = foods[j];
      if (food.x == array[i].x && food.y == array[i].y) {
        //in case that food spawn on top of player
        var rnd_coords = getRndCoords();
        food["x"] = rnd_coords["x"]; //we use this way to not clear the capacity of the food (if there is one)
        food["y"] = rnd_coords["y"];
      }
    }
    if (head.x == array[i].x && head.y == array[i].y) {
      return true;
    }
  }
  return false;
}

function calculate_food(i) {//fonction qui permet de calculer la nourriture (les actions spéciales) et de les appliquer
  let food = foods[i];
  if (!("capacity" in food) && capacity[i] && "action" in capacity[i]) {
    foods[i]["capacity"] = [
      capacity[i]["action"][0],
      Date.now() + capacity[i]["action"][1],
    ];
    if (capacity[i]["action"].length > 2) {
      foods[i]["capacity"].push(capacity[i]["action"][2]);
    }
  } else if ("capacity" in food) {
    cap = food["capacity"];
    switch (cap[0]) {
      case "teleport":
        //console.log(cap); //debug_mode only (lag)
        if (cap[1] - Date.now() < 0) {
          foods[i] =
            cap[2] && cap[2] == "near" ? getNearRndCoords() : getRndCoords(); //reset pose and time {x:0,y:0}
        }
        break;
      case "disapear":
        if (cap[1] - Date.now() < 0) {
          delete foods[i];
        }
        break;
    }
  }
}

function draw_food(i) {//fonction qui permet de dessiner la nourriture
    ctx.beginPath();
    let color_ = colors[i];
    let food = foods[i];
    if ("capacity" in foods[i] && capacity[i]["action"][1] > 0) {
      cap = food["capacity"];
      let delta = cap[1] - Date.now();
      if (delta < 100) {
        delta = 1;
      } //on sait jamais même si sa devrai jamais arriver
      color_ += Math.floor((delta / capacity[i]["action"][1]) * 255).toString(16);
    }
    ctx.fillStyle = color_;
    ctx.strokeStyle = "white";
    ctx.arc(food.x + box / 2, food.y + box / 2, box / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
}

function food_main(no_loop = false){//fonction qui permet de faire fonctionner la nourriture
  if(pause){return}
  for(var i in foods){  
    draw_food(i);
    calculate_food(i);
  }
  if (no_loop) {
    return;
  } //prevent multi loops
  return (food_display = requestAnimationFrame(food_main));
}

let flag_in_three_pixels = [
  "blue","white","red","white",
  "green","white","red","white",
  "black","yellow","red","white",
  "blue","yellow","red","white",
];
function color_from_i(i) {//fonction qui permet de calculer les couleurs du serpent (en fonction de i le bloc du serpent)
  if(i>=flag_in_three_pixels.length){return "lightgreen";}
  return FLAGSNAKE?flag_in_three_pixels[i-1]:"lightgreen";
}

increment_for_stat_tick = 0;
function draw() {//fonction qui permet de dessiner le jeu (le serpent, la nourriture, le score, le temps, ...)
  if(pause){return}
  increment_for_stat_tick++;
  if (increment_for_stat_tick == 10*10) {
    score_in_time.push([score, mangee, T1]);
    increment_for_stat_tick = 0;
  }
  ctx.reset();
  for (let i = 0; i < me.length; i++) {
    ctx.beginPath();
    if(debug_mode){console.log('%c #' + color_from_i(i), 'color: ' + color_from_i(i));}
    switch (current_style) {
      case "new":
        ctx.fillStyle = i == 0 ? "white" : color_from_i(i);
        let w = (box / 2) * ((me.length - i) / me.length) + 5;
        ctx.rect(me[i].x + (box - w) / 2, me[i].y + (box - w) / 2, w, w);
        break;
      case "old":
        ctx.fillStyle = i == 0 ? "white" : "black";
        ctx.rect(me[i].x, me[i].y, box - 1, box - 1);
        ctx.strokeStyle = "white";
        ctx.stroke();
        break;
    }
    ctx.fill();
    ctx.closePath();
  }
  food_main(true); //prevent blinking + better graphisme
  //ctx.shadowColor ="";
  //ctx.shadowBlur = 0;
  // old head position
  showScore();
  let meX = me[0].x;
  let meY = me[0].y;
  let ancientHead = me[0];
  //console.log(meX,meY,current_direction);
  if (current_direction == "gauche") meX -= box;
  else if (current_direction == "droite")
    meX += box; //else if to prevent 1 ms direction change (impossible)
  else if (current_direction == "haut") meY -= box;
  else if (current_direction == "bas") meY += box;
  direction_applied = true;
  let touched_food = false;
  let newHead = {
    x: meX,
    y: meY,
  };
  for (var i in foods) {//boucle qui permet de vérifier si le serpent touche la nourriture
    var food = foods[i];
    if (meX == food.x && meY == food.y) {
      //if head touch food
      if (capacity[i]) {
        score += capacity[i]["score"]; //add custom score to total_score
        if (
          "action" in capacity[i] &&
          capacity[i]["action"][0] == "teleport_snake"
        ) {
          if (Math.random() < 0.8) {
            //80 % chance of doing the action
            newHead = {
              x: box * Math.floor(Math.random() * 4 + 10),
              y: box * Math.floor(Math.random() * 4 + 9),
            };
            while (collision(newHead, me)) {
              //while in case head go on body
              newHead = {
                x: box * Math.floor(Math.random() * 4 + 10),
                y: box * Math.floor(Math.random() * 4 + 9),
              };
            }
            soundboard["teleport"](); //nice sound
          }
        }
      } else {
        score++;
      }
      touched_food = true;
      mangee++;
      soundboard["eat"]();
      foods[i] = (capacity[i] && "action" in capacity[i] && capacity[i]["action"].length == 2 && capacity[i]["action"][1] == "near") ? getNearRndCoords() : getRndCoords();
      //if near then nearcoords else normal coords
    }
  }
  if (
    mangee % (debug_mode?2:5) == 0 &&
    Math.round(mangee / (debug_mode?2:5)) == foods.length && //increment food number on the game
    foods.length < colors.length
  ) {
    foods.push(getRndCoords()); //every 5 mangee add one food block
    if (mangee % 10 == 0) {
      soundboard["score"]();
    }
  }
  if (!touched_food) {
    me.pop();
  }
  
  if (
    meX < 0 ||
    Math.floor(meX/box) > max_box[0] ||
    meY < 0 ||
    Math.floor(meY/box) > max_box[1] || //simple detection sys
    collision(ancientHead, me)
  ) {
    //console.log(meX < 0 , meX > canvas.width , meY < 0 , meY > canvas.height , collision(ancientHead,me));//debug_mode stuff
    window.cancelAnimationFrame(game);
    window.cancelAnimationFrame(food_display);
    return gameOver();
  }
  me.unshift(newHead);
  return setTimeout(function onTick() {
    return (game = window.requestAnimationFrame(draw));
  }, tick);
}
function showScore() {
  //simple function to show score
  ctx.fillStyle = "white";
  ctx.font = "45px gotham";
  ctx.fillText(`Score: ${score}`, 2 * box, 1.6 * box);
}

let input_list = [];
document.addEventListener(
  "keypress",
  async function (event) {
    //fonction qui permet de détecter les touches
    if (event.key == "&" && debug_mode){mangee++;}//sshhh don't tell anyone
    if (input_list == "full") {
      return;
    }
    if (event.key == "=") {
      return (input_list = []);
    }
    if (input_list.length > 6) {
      return (input_list = []);
    }
    input_list.push(event.key);
    if (btoa(input_list.join("")) == "c25ha2Vz") {
      //detection of easter inputs
      input_list = "full";
      window.scrollTo(0,0);
      swal.fire({
          title: "Snake",
          text: "utilisez les flèches directionnelles pour jouer",
          icon: "info",
          showCloseButton: true,
          showCancelButton: true,
          showDenyButton: true,
          cancelButtonText: "annuler",
          confirmButtonText: "Jouer",
          denyButtonText: "statistiques",
        })
        .then(async (result) => {
          if (result.isConfirmed) {
            await play();
          } else if(result.isDenied) {
           showStats();
          }else{
            document.body.removeChild(canvas);
          }
        });
    }
  },
  true
);
