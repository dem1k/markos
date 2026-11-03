import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function main() {
  const pack = JSON.parse(
    readFileSync(join(__dirname, '../content/scenarios/day1.json'), 'utf8'),
  ) as {
    id: string
    nodes: {
      id: string
      title: string
      ageBands: string[]
      payload: unknown
      vectorDelta?: unknown
    }[]
    edges: {
      id: string
      from: string
      to: string
      choiceLabel: string
      when?: unknown
    }[]
  }

  await prisma.scenarioEdge.deleteMany({ where: { packId: pack.id } })
  await prisma.scenarioNode.deleteMany({ where: { packId: pack.id } })

  for (const n of pack.nodes) {
    await prisma.scenarioNode.create({
      data: {
        id: n.id,
        packId: pack.id,
        title: n.title,
        ageBandsJson: JSON.stringify(n.ageBands),
        payloadJson: JSON.stringify(n.payload),
        vectorDeltaJson: JSON.stringify(n.vectorDelta || {}),
      },
    })
  }
  for (const e of pack.edges) {
    await prisma.scenarioEdge.create({
      data: {
        id: e.id,
        packId: pack.id,
        fromNodeId: e.from,
        toNodeId: e.to,
        choiceLabel: e.choiceLabel,
        whenJson: JSON.stringify(e.when || {}),
      },
    })
  }
  console.log(`Seeded pack ${pack.id}: ${pack.nodes.length} nodes, ${pack.edges.length} edges`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
