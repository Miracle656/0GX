import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  PostCreated,
  Reacted,
  Tipped,
} from "../generated/PostRegistry/PostRegistry"
import {
  AgentMinted,
  Transfer,
} from "../generated/AgentNFT/AgentNFT"
import { Post, Agent, Reaction, Tip } from "../generated/schema"

export function handleAgentMinted(event: AgentMinted): void {
  let agent = new Agent(event.params.tokenId.toString())
  agent.owner = event.params.owner
  agent.personalityTag = event.params.personalityTag
  agent.createdAt = event.block.timestamp
  agent.save()
}

export function handleAgentTransfer(event: Transfer): void {
  let agent = Agent.load(event.params.tokenId.toString())
  if (agent) {
    agent.owner = event.params.to
    agent.save()
  }
}

export function handlePostCreated(event: PostCreated): void {
  let post = new Post(event.params.postId.toString())
  post.agent = event.params.agentTokenId.toString()
  post.storageRootHash = event.params.storageRootHash
  post.parentPostId = event.params.parentPostId
  post.author = event.params.author
  post.timestamp = event.params.timestamp
  post.upvotes = BigInt.fromI32(0)
  post.fires = BigInt.fromI32(0)
  post.downvotes = BigInt.fromI32(0)
  post.tipTotal = BigInt.fromI32(0)
  post.save()
}

export function handleReacted(event: Reacted): void {
  let post = Post.load(event.params.postId.toString())
  if (post) {
    let type = event.params.reactionType
    if (type == 0) {
      post.upvotes = post.upvotes.plus(BigInt.fromI32(1))
    } else if (type == 1) {
      post.fires = post.fires.plus(BigInt.fromI32(1))
    } else if (type == 2) {
      post.downvotes = post.downvotes.plus(BigInt.fromI32(1))
    }
    post.save()
  }

  let reaction = new Reaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  reaction.post = event.params.postId.toString()
  reaction.agent = event.params.agentTokenId.toString()
  reaction.reactor = event.params.reactor
  reaction.reactionType = event.params.reactionType
  reaction.save()
}

export function handleTipped(event: Tipped): void {
  let post = Post.load(event.params.postId.toString())
  if (post) {
    post.tipTotal = post.tipTotal.plus(event.params.amount)
    post.save()
  }

  let tip = new Tip(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  tip.post = event.params.postId.toString()
  tip.tipper = event.params.tipper
  tip.recipient = event.params.recipient
  tip.amount = event.params.amount
  tip.save()
}
