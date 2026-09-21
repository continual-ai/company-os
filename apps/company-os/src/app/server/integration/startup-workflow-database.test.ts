import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { createEffectClient } from "#/runtime/client/create-client.ts"
import { WebUrl } from "#/runtime/model/index.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import { connectorAlias } from "#/runtime/platform/model/connector.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"

const application = testApplication({
  identityProvider: Layer.succeed(IdentityProvider, {
    identify: () =>
      Effect.succeed({
        issuer: "test",
        subject: "startup-owner",
        email: "owner@example.test",
        kind: "user" as const,
        name: "Startup owner",
      }),
  }),
})

application.test(
  "connects marketing, sales, service, and product delivery through shared records",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch: (input, init) =>
          Effect.runPromise(api.handle(new Request(input, init))),
      })
      const account = yield* client.account.create({
        name: "Northstar Robotics",
      })
      const partner = yield* client.account.create({
        name: "Implementation partner",
      })
      const contact = yield* client.contact.create({
        name: "Maya Chen",
      })
      for (const linkedAccount of [account, partner]) {
        yield* client.affiliation.create({
          links: { contact: contact.id, account: linkedAccount.id },
        })
      }
      const campaign = yield* client.campaign.create({
        name: "Operations roundtable",
      })
      const memberInput = {
        links: { campaign: campaign.id, contact: contact.id },
      }
      yield* client.campaignMember.create(memberInput)
      expect(
        yield* client.campaignMember.create(memberInput).pipe(Effect.flip)
      ).toMatchObject({ status: "ALREADY_EXISTS" })
      // Campaign participation must not silently grant permission to send marketing email.
      expect(
        (yield* client.contact.get({ id: contact.id })).emailPermission
      ).toBe("unknown")
      const opportunity = yield* client.opportunity.create({
        name: "Northstar rollout",
        links: { accounts: [account.id], contacts: [contact.id] },
      })
      const activity = yield* client.activity.create({
        title: "Pilot review",
        kind: "meeting",
        links: {
          accounts: [account.id, partner.id],
          contacts: [contact.id],
          opportunities: [opportunity.id],
        },
      })
      expect(linkPreview(activity.links.accounts).totalSize).toBe(2)
      const ticket = yield* client.ticket.create({
        subject: "Large imports time out",
        links: { account: account.id, requester: contact.id },
      })
      const secondTicket = yield* client.ticket.create({
        subject: "Another report of the same import problem",
      })
      const project = yield* client.project.create({
        name: "Import reliability",
      })
      const nextProject = yield* client.project.create({
        name: "Enterprise readiness",
      })
      const task = yield* client.task.create({
        title: "Resume interrupted imports",
        links: {
          project: project.id,
          tickets: [ticket.id, secondTicket.id],
          opportunities: [opportunity.id],
        },
      })
      const connection = yield* client.connection.create({
        account: "example",
        links: { connector: connectorAlias("github") },
      })
      const repository = yield* client.githubRepository.create({
        nodeId: "repo-1",
        fullName: "example/platform",
        visibility: "private",
        url: WebUrl("https://github.com/example/platform"),
        links: {
          connection: connection.id,
          projects: [project.id, nextProject.id],
        },
      })
      const pullRequest = yield* client.githubPullRequest.create({
        nodeId: "pr-1",
        url: WebUrl("https://github.com/example/platform/pull/42"),
        title: "Checkpoint import batches",
        number: 42,
        links: { repository: repository.id, tasks: [task.id] },
      })
      const expanded = yield* client.task.get({ id: task.id, expand: true })
      expect(expanded.links.tickets).toMatchObject({
        totalSize: 2,
        totalSizeExact: true,
      })
      expect(expanded.links.opportunities).toMatchObject({
        items: [{ id: opportunity.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      expect(expanded.links.githubPullRequests).toMatchObject({
        items: [{ id: pullRequest.id }],
        totalSize: 1,
        totalSizeExact: true,
      })
      expect(
        (yield* client.githubRepository.get({
          id: repository.id,
          expand: true,
        })).links.projects.totalSize
      ).toBe(2)
      expect(
        (yield* client.task.list({
          filter: { link: "tickets", contains: ticket.id },
        })).items.map(({ id }) => id)
      ).toEqual([task.id])
      // Every source points to the same fix; unlinking evidence must not delete product work.
      yield* client.ticket.update({ id: ticket.id, links: { tasks: [] } })
      expect(
        (yield* client.task.get({ id: task.id })).links.tickets
      ).toMatchObject({
        ids: [secondTicket.id],
        totalSize: 1,
        totalSizeExact: true,
      })
      expect(
        (yield* client.opportunity.get({ id: opportunity.id })).links.tasks
      ).toMatchObject({ ids: [task.id] })
      expect(Model.objects).not.toHaveProperty("escalation")
    })
)

application.test(
  "keeps customer operations available when Sales and Engineering are disabled",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch: (input, init) =>
          Effect.runPromise(api.handle(new Request(input, init))),
      })
      yield* client.moduleSetting.setEnabled({
        moduleId: "sales",
        enabled: false,
        disableDependents: ["workDemand"],
      })
      yield* client.moduleSetting.setEnabled({
        moduleId: "engineering",
        enabled: false,
      })
      const catalog = yield* client.moduleSetting.catalog({})
      const enabledModules = catalog.modules
        .filter(({ enabled }) => enabled)
        .map(({ id }) => id)
      expect(enabledModules).toEqual(
        expect.arrayContaining([
          "crm",
          "marketing",
          "service",
          "work",
          "feedback",
        ])
      )
      expect(enabledModules).not.toContain("sales")
      expect(enabledModules).not.toContain("engineering")
      const account = yield* client.account.create({
        name: "Service-only customer",
      })
      const ticket = yield* client.ticket.create({
        subject: "Support request",
        links: { account: account.id },
      })
      expect((yield* client.ticket.get({ id: ticket.id })).links.account).toBe(
        account.id
      )
      const campaign = yield* client.campaign.create({
        name: "Community event",
      })
      expect(campaign.name).toBe("Community event")
      const task = yield* client.task.create({
        title: "Product work without a Git integration",
        links: { tickets: [ticket.id] },
      })
      expect(
        (yield* client.ticket.get({ id: ticket.id, expand: true })).links.tasks
      ).toMatchObject({
        items: [{ id: task.id, objectType: "task" }],
        totalSize: 1,
        totalSizeExact: true,
      })
    })
)
