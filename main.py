from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
from pydantic import BaseModel
from typing import Dict, List, Optional
import random
import string
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

app = FastAPI()

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


class CreatePartyResponse(BaseModel):
  party_id: str


class JoinPartyRequest(BaseModel):
  party_id: str


class RegisterPlayerRequest(BaseModel):
  party_id: str
  player_name: str


class RegisterPlayerResponse(BaseModel):
  party_id: str
  player_id: str
  name: str
  stars: int
  is_host: bool


class StartRoundRequest(BaseModel):
  party_id: str
  player_id: str


class SubmitVoteRequest(BaseModel):
  party_id: str
  player_id: str
  target_player_id: str


class StarChooseTaskRequest(BaseModel):
  party_id: str
  player_id: str
  task_index: int


POSITIVE_ATTRIBUTES = [
  "good looking",
  "smart",
  "kind",
  "loyal",
  "funny",
  "charming",
  "creative",
  "confident",
  "calm",
  "adventurous",
  "caring",
  "supportive",
  "honest",
  "reliable",
  "talented",
  "romantic",
  "energetic",
  "wise",
  "a good listener",
  "well dressed",
]

NEGATIVE_ATTRIBUTES = [
  "a drama magnet",
  "always late",
  "an over thinker",
  "phone addicted",
  "too honest",
  "a chaos maker",
  "talkative",
  "a daydreamer",
  "a snack thief",
  "forgetful",
  "easily distracted",
  "a meme addict",
  "a procrastinator",
  "always confused",
  "a loud laugher",
  "a sleepy head",
  "an over reactor",
  "a control freak",
  "a bit clumsy",
  "a pain in the neck",
]

POSITIVE_TASKS = [
  "Tell the best memory you have with someone in this room.",
  "Say one true compliment about each person here, short and sweet.",
  "Tell a story when you felt really proud of yourself.",
  "Describe your dream trip and who here you would take with you and why.",
  "Tell a funny story about yourself that most people here do not know.",
  "Share one thing you really like about the person who created this party.",
  "Share one thing you really like about the person on your right.",
  "Share one thing you really like about the person on your left.",
  "Tell the group what you think is your secret super power and why.",
  "Tell the funniest moment you remember with this group.",
  "Do a short pantomime of a moment you loved in your life and let people guess what it was.",
  "Sing one chorus of a song you like, the group can sing with you.",
  "Do a thirty second dance like you just won the lottery.",
  "Act out your perfect morning using only gestures.",
  "Pick a person here and try to imitate their walk for ten seconds in a kind way.",
  "Do a fake award speech as if you just won an Oscar and thank people in this room.",
  "Make up a short slogan for this group and say it like an advertisement.",
  "Pretend you are the host of a talk show and introduce each person in one sentence.",
  "Choose a song and do a dramatic slow motion performance for ten seconds.",
  "Act out your favorite movie scene without naming the movie.",
  "Choose one person and share one thing you learned from them.",
  "Ask everyone to close their eyes, then describe one positive trait for each person.",
  "Let the group ask you three questions about anything and you must answer honestly.",
  "Pick two people and tell the group why they would be a great team in a heist movie.",
  "Create a group selfie pose right now and tell everyone how to stand.",
  "Choose a simple pose and make everyone copy you for a group photo.",
  "Make up a short toast for this group and say it out loud.",
  "Let everyone give you a one word compliment, then repeat them all in one sentence.",
  "Choose a future plan you want to do with this group and share it.",
  "Give each person a funny but kind nickname on the spot.",
]

NEGATIVE_TASKS = [
  "Pick a song and do your most ridiculous dance for thirty seconds.",
  "Speak in an exaggerated movie trailer voice for one minute.",
  "Act out an over dramatic soap opera scene for twenty seconds.",
  "Choose a random object near you and sell it to the group like a sales person.",
  "Do a slow motion fail scene like tripping in a cartoon for fifteen seconds.",
  "Pretend you are a robot with low battery for thirty seconds.",
  "Imitate three different animals in thirty seconds.",
  "Pretend you are an over excited fitness coach for thirty seconds.",
  "Act out a very serious news report about something totally silly in the room.",
  "Do a runway walk from one side of the room to the other with full model attitude.",
  "Tell the group about a recent small fail or awkward moment you had.",
  "Share the most embarrassing but safe thing you did in school.",
  "Tell the group your cringiest old social media post that you remember.",
  "Try to roast yourself for fifteen seconds in a playful way.",
  "Tell a story when you arrived very late and what happened.",
  "Share a funny lie you once told to avoid something small.",
  "Admit one silly habit you know you have.",
  "Describe your most chaotic morning in detail.",
  "Tell the group about a time you were completely confused.",
  "Share a time when you laughed in a serious moment and could not stop.",
  "Let the group decide a harmless pose for you and hold it for ten seconds.",
  "Let another player choose a song and you must hum it until someone guesses it.",
  "Let one person rearrange your hair or hat in a funny way for one round.",
  "Stand up and do ten very dramatic slow jumping jacks.",
  "Spin around in place ten times and then walk in a straight line.",
  "Let the group ask you three quick questions where you must answer in three words only.",
  "Let everyone vote and pick one person you must follow like a shadow for thirty seconds.",
  "Swap seats with someone the group chooses and say one nice thing about them.",
  "Let another player choose a famous character and you must act like them for one round.",
  "Close your eyes, point at someone randomly, then give them a compliment in a funny voice.",
]


class Player:
  def __init__(self, player_id: str, name: str):
    self.id = player_id
    self.name = name
    self.stars = 0


class RoundState:
  def __init__(self, question_id: int, text: str, is_positive: bool):
    self.question_id = question_id
    self.text = text
    self.is_positive = is_positive
    self.votes: Dict[str, str] = {}
    self.star_player_id: Optional[str] = None
    self.task_options: List[str] = []
    self.selected_task: Optional[str] = None


class Party:
  def __init__(self, party_id: str):
    self.party_id = party_id
    self.players: Dict[str, Player] = {}
    self.host_id: Optional[str] = None
    self.created_at = time.time()

    self.questions: List[Dict] = []
    q_id = 0
    for attr in POSITIVE_ATTRIBUTES:
      self.questions.append(
        {
          "id": q_id,
          "text": f"Who is the most {attr}?",
          "is_positive": True,
        }
      )
      q_id += 1
    for attr in NEGATIVE_ATTRIBUTES:
      self.questions.append(
        {
          "id": q_id,
          "text": f"Who is the most {attr}?",
          "is_positive": False,
        }
      )
      q_id += 1

    random.shuffle(self.questions)
    self.question_index = 0

    self.available_positive_tasks = POSITIVE_TASKS.copy()
    self.available_negative_tasks = NEGATIVE_TASKS.copy()

    self.state: str = "idle"
    self.current_round: Optional[RoundState] = None
    self.round_number: int = 0


PARTIES: Dict[str, Party] = {}


def generate_party_id() -> str:
  for _ in range(100):
    code = f"{random.randint(0, 9999):04d}"
    if code not in PARTIES:
      return code
  raise RuntimeError("Could not allocate party id")


def generate_player_id() -> str:
  return "".join(random.choices(string.ascii_letters + string.digits, k=8))


@app.get("/")
async def index(request: Request):
  return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/create_party", response_model=CreatePartyResponse)
async def create_party():
  party_id = generate_party_id()
  party = Party(party_id)
  PARTIES[party_id] = party
  return CreatePartyResponse(party_id=party_id)


@app.post("/api/join_party")
async def join_party(req: JoinPartyRequest):
  party_id = req.party_id.strip()
  if party_id not in PARTIES:
    raise HTTPException(status_code=404, detail="Party not found")
  return {"party_id": party_id}


@app.post("/api/register_player", response_model=RegisterPlayerResponse)
async def register_player(req: RegisterPlayerRequest):
  party = PARTIES.get(req.party_id)
  if not party:
    raise HTTPException(status_code=404, detail="Party not found")

  name = req.player_name.strip()
  if not name:
    raise HTTPException(status_code=400, detail="Name cannot be empty")
  if len(name) > 10:
    raise HTTPException(status_code=400, detail="Name must be at most 10 characters")

  player_id = generate_player_id()
  player = Player(player_id, name)
  party.players[player_id] = player

  if party.host_id is None:
    party.host_id = player_id

  return RegisterPlayerResponse(
    party_id=party.party_id,
    player_id=player_id,
    name=player.name,
    stars=player.stars,
    is_host=(player_id == party.host_id),
  )


@app.post("/api/start_round")
async def start_round(req: StartRoundRequest):
  party = PARTIES.get(req.party_id)
  if not party:
    raise HTTPException(status_code=404, detail="Party not found")

  if req.player_id != party.host_id:
    raise HTTPException(status_code=403, detail="Only host can start rounds")

  if party.state not in ("idle", "task_result"):
    raise HTTPException(status_code=400, detail="Cannot start a round right now")

  if party.question_index >= len(party.questions):
    party.state = "finished"
    party.current_round = None
    return {"status": "finished"}

  q = party.questions[party.question_index]
  party.question_index += 1
  party.round_number += 1

  rs = RoundState(question_id=q["id"], text=q["text"], is_positive=q["is_positive"])
  party.current_round = rs
  party.state = "voting"

  return {"status": "ok"}


@app.post("/api/submit_vote")
async def submit_vote(req: SubmitVoteRequest):
  party = PARTIES.get(req.party_id)
  if not party:
    raise HTTPException(status_code=404, detail="Party not found")

  if party.state != "voting" or not party.current_round:
    raise HTTPException(status_code=400, detail="Not in voting state")

  if req.player_id not in party.players:
    raise HTTPException(status_code=404, detail="Player not found")

  if req.target_player_id not in party.players:
    raise HTTPException(status_code=400, detail="Target player not found")

  rs = party.current_round

  if req.player_id in rs.votes:
    raise HTTPException(status_code=400, detail="You already voted")

  rs.votes[req.player_id] = req.target_player_id

  if len(rs.votes) == len(party.players):
    counts: Dict[str, int] = {}
    for _, target_id in rs.votes.items():
      counts[target_id] = counts.get(target_id, 0) + 1

    if counts:
      max_count = max(counts.values())
      top_targets = [pid for pid, c in counts.items() if c == max_count]
      star = random.choice(top_targets)
      rs.star_player_id = star
      party.players[star].stars += 1

      if rs.is_positive:
        pool = party.available_positive_tasks
      else:
        pool = party.available_negative_tasks

      if len(pool) >= 2:
        rs.task_options = random.sample(pool, 2)
      elif len(pool) == 1:
        rs.task_options = pool.copy()
      else:
        rs.task_options = [
          "Share something nice with the group.",
          "Do a funny pose.",
        ]

      party.state = "task_choice"

  return {"status": "ok"}


@app.post("/api/star_choose_task")
async def star_choose_task(req: StarChooseTaskRequest):
  party = PARTIES.get(req.party_id)
  if not party:
    raise HTTPException(status_code=404, detail="Party not found")

  if party.state != "task_choice" or not party.current_round:
    raise HTTPException(status_code=400, detail="Not in task choice state")

  rs = party.current_round

  if rs.star_player_id != req.player_id:
    raise HTTPException(status_code=403, detail="Only the star can pick a task")

  if req.task_index < 0 or req.task_index >= len(rs.task_options):
    raise HTTPException(status_code=400, detail="Invalid task index")

  chosen = rs.task_options[req.task_index]
  rs.selected_task = chosen

  if rs.is_positive:
    pool = party.available_positive_tasks
  else:
    pool = party.available_negative_tasks

  if chosen in pool:
    pool.remove(chosen)

  party.state = "task_result"
  return {"status": "ok"}


@app.get("/api/party_state")
async def party_state(party_id: str, player_id: str):
  party = PARTIES.get(party_id)
  if not party:
    raise HTTPException(status_code=404, detail="Party not found")

  if player_id not in party.players:
    raise HTTPException(status_code=404, detail="Player not in this party")

  you = party.players[player_id]

  players_payload = [
    {"id": p.id, "name": p.name, "stars": p.stars}
    for p in party.players.values()
  ]
  players_payload.sort(key=lambda x: (-x["stars"], x["name"].lower()))

  response = {
    "party_id": party.party_id,
    "state": party.state,
    "round_number": party.round_number,
    "questions_left": max(0, len(party.questions) - party.question_index),
    "host_id": party.host_id,
    "me_is_host": (player_id == party.host_id),
    "players": players_payload,
    "you": {
      "id": you.id,
      "name": you.name,
      "stars": you.stars,
      "has_voted": False,
      "vote_target_id": None,
    },
    "question_text": None,
    "is_positive": None,
    "star_player_id": None,
    "star_player_name": None,
    "task_options_for_star": [],
    "selected_task": None,
  }

  if party.state in ("voting", "task_choice", "task_result"):
    rs = party.current_round
    if rs:
      response["question_text"] = rs.text
      response["is_positive"] = rs.is_positive

      if party.state == "voting":
        response["you"]["has_voted"] = player_id in rs.votes
        response["you"]["vote_target_id"] = rs.votes.get(player_id)

      if rs.star_player_id:
        response["star_player_id"] = rs.star_player_id
        response["star_player_name"] = party.players[rs.star_player_id].name

      if party.state == "task_choice":
        if player_id == rs.star_player_id:
          response["task_options_for_star"] = rs.task_options

      if party.state == "task_result":
        response["selected_task"] = rs.selected_task

  return response