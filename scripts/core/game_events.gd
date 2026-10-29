## Shared (orchestrator-owned). Global event bus. Npc re-emits its local signals here
## with itself as the first argument, so FX/UI/audio can listen without knowing NPCs.
## Only Npc (scripts/npc/npc.gd) emits the npc_* signals. Anyone may emit audio_cue.
extends Node

signal npc_spawned(npc: Node)
signal npc_wounded(npc: Node, wound: Wound, ev: DamageEvent)
signal npc_part_broken(npc: Node, part_id: int)
signal npc_part_severed(npc: Node, part_id: int, severed_root: RigidBody3D, ev: DamageEvent)
signal npc_state_changed(npc: Node, old_state: int, new_state: int)
signal npc_died(npc: Node, cause: StringName)
signal npc_stunned(npc: Node, duration: float, cause: StringName)
## Audio hook. cue examples: scream, grunt, gurgle, pain_breath, gunshot, knife_hit,
## bat_hit, bone_crack, sever, body_fall. npc may be null. Played by GoreFX/audio.
signal audio_cue(npc: Node, cue: StringName, position: Vector3, intensity: float)
## Generic impact (any surface) for decals/particles, e.g. bullet hitting the floor.
signal world_impact(position: Vector3, normal: Vector3, ev: DamageEvent)
## Fight-back: an NPC landed a hit on the player. Player (group "player") applies it.
signal player_hit(npc: Node, amount: float, position: Vector3)
## Milestone 5: head chunk destroyed (gib = thrown-off piece or null).
signal npc_head_chunk_destroyed(npc: Node, chunk: int, gib: RigidBody3D, ev: DamageEvent)
