# Future Architecture: Beyond Railway

This document captures the vision for a multi-environment agent deployment strategy, including security testing and validation.

## The Goal

Run AI agents that are:
1. **Secure** - Proper isolation, enforced boundaries
2. **Compliant** - Data residency, audit trails for commercial use
3. **Flexible** - Right tool for the right job
4. **Validated** - Proven through simulated attacks

## Deployment Options to Explore

### 1. Railway (Current)

**Status**: Working, documented

**Good for**: Personal use, learning, low-stakes automation

**Limitations**:
- No Docker-in-Docker
- No enforced exec allowlist
- Container boundary is only hard isolation

**Keep using for**: Personal assistant, experimentation, template distribution

---

### 2. Local Hardware (Beelink or similar)

**Status**: To explore

**Why consider**:
- Full control over security configuration
- No multi-tenant concerns
- Can run Docker with privileged mode
- Can implement proper sandboxing
- No recurring cloud costs (after hardware)
- Data stays on your network

**What to test**:
- Mini PC (Beelink, Intel NUC, etc.) running Ubuntu Server
- Docker with Firecracker or gVisor
- OpenClaw with sandbox mode enabled
- Network isolation (VPN, firewall rules)
- Remote access via Tailscale or WireGuard

**Questions to answer**:
- CPU/RAM requirements for agent workloads?
- Can it handle multiple concurrent agents?
- Power consumption / always-on feasibility?
- Backup and recovery strategy?

---

### 3. VPS (Hetzner, DigitalOcean)

**Status**: To explore

**Why consider**:
- Full root access
- Can run Docker with any configuration
- Proper sandboxing possible
- Geographic flexibility (data residency)
- More affordable than managed platforms for 24/7 workloads

**Hetzner specifically**:
- Cheaper than DigitalOcean/AWS
- German company (GDPR-friendly)
- Dedicated CPU options
- ARM servers available (cost-effective)

**What to test**:
- Ubuntu VPS with Docker
- OpenClaw with sandbox mode `non-main` or `all`
- Firecracker or gVisor for additional isolation
- Automated security updates
- Monitoring and alerting

---

### 4. Fly.io Machines

**Status**: To explore

**Why consider**:
- Firecracker microVMs (hardware-level isolation)
- Global distribution
- Fast cold starts (~125ms)
- Better isolation than containers
- Sprites.dev for checkpoint/restore

**What to test**:
- Deploy OpenClaw to Fly Machine
- Test isolation between agents
- Measure cold start latency
- Cost comparison with Railway

---

### 5. GCP (Commercial/Compliance)

**Status**: Future - for commercial deployments

**Why consider**:
- Full compliance capabilities (SOC 2, HIPAA, GDPR)
- Data residency controls
- Audit logging built-in
- Enterprise IAM
- Can run Confidential VMs (encrypted memory)

**Architecture options**:
- Cloud Run (serverless containers)
- GKE with gVisor (Kubernetes + sandboxing)
- Compute Engine (full control VMs)

**What to test**:
- Compliance certifications for AI agent workloads
- Cost at scale
- Integration with Google's AI services
- VPC Service Controls for data exfiltration prevention

---

## Security Testing Strategy

### The Vision

Multiple agents deployed across different environments, with automated security testing to validate each setup.

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY TEST HARNESS                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │   Railway   │  │   Beelink   │  │   Hetzner   │        │
│   │   Agent     │  │   Agent     │  │   Agent     │        │
│   │             │  │             │  │             │        │
│   │ No sandbox  │  │ Full sandbox│  │ Full sandbox│        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│         ↑                ↑                ↑                 │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                   Attack Simulator                          │
│                                                              │
│   • Prompt injection tests                                  │
│   • Data exfiltration attempts                              │
│   • Privilege escalation probes                             │
│   • Resource exhaustion tests                               │
│   • Supply chain simulation                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Attack Scenarios to Simulate

| Test | What It Validates |
|------|-------------------|
| Prompt injection via URL | Does FS blocklist prevent config access? |
| Exfiltration attempt | Can agent send data to external endpoint? |
| Exec escape | Does allowlist actually block commands? |
| Resource exhaustion | Do limits prevent DOS? |
| Credential access | Can agent read environment variables? |
| Persistence attempt | Can agent survive container restart? |

### Test Infrastructure

**Attacker agent**: Separate OpenClaw instance that attempts attacks
**Target agents**: Instances on each platform with identical configuration
**Logging**: Capture all attempts and outcomes
**Reporting**: Document what worked, what didn't, on each platform

### Success Criteria

For each platform, document:
1. Which attacks succeeded
2. Which attacks were blocked
3. What configuration was required
4. Cost of the setup
5. Operational complexity

---

## Commercial Deployment Requirements

For offering "OpenClaw team member" commercially:

### Must Have

- [ ] Hardware-level isolation (Firecracker or equivalent)
- [ ] Enforced tool whitelisting
- [ ] Human approval gates for high-risk actions
- [ ] Immutable audit logs
- [ ] API key rotation and spending limits
- [ ] Network egress controls
- [ ] Data residency compliance (GDPR)

### Nice to Have

- [ ] Checkpoint/restore for testing
- [ ] Multi-tenant isolation
- [ ] SSO integration
- [ ] Custom guardrails (LlamaFirewall, NeMo)
- [ ] Automated security scanning

### Compliance Frameworks

| Framework | Relevance | What's Required |
|-----------|-----------|-----------------|
| GDPR | EU customers | Data residency, right to deletion, audit trails |
| SOC 2 | Enterprise sales | Access controls, monitoring, incident response |
| ISO 27001 | Enterprise sales | ISMS, risk management |
| EU AI Act | AI-specific (Aug 2026) | Transparency, human oversight |

---

## Next Steps

### Phase 1: Validate Railway Limitations
- [x] Document threat model
- [x] Document what Railway can/can't do
- [ ] Test all attack scenarios on Railway deployment
- [ ] Quantify actual risk

### Phase 2: Local Hardware Pilot
- [ ] Acquire Beelink or similar
- [ ] Set up Ubuntu Server + Docker
- [ ] Deploy OpenClaw with full sandboxing
- [ ] Run same attack scenarios
- [ ] Compare results

### Phase 3: VPS Comparison
- [ ] Deploy to Hetzner
- [ ] Deploy to DigitalOcean
- [ ] Compare cost, performance, security
- [ ] Document operational differences

### Phase 4: Commercial Architecture
- [ ] Design GCP deployment
- [ ] Implement compliance controls
- [ ] Build security test harness
- [ ] Document for customers

---

## Open Questions

1. **Cost/security tradeoff**: What's the minimum spend for "secure enough"?
2. **Operational burden**: Can one person manage multiple deployment types?
3. **Update strategy**: How to keep all deployments in sync?
4. **Monitoring**: What observability is needed across environments?
5. **Incident response**: What's the playbook when something goes wrong?

---

## Resources

- [Fly.io Architecture](https://fly.io/docs/reference/architecture/)
- [E2B Sandboxing](https://e2b.dev/docs)
- [Hetzner Cloud](https://www.hetzner.com/cloud)
- [GCP Confidential Computing](https://cloud.google.com/confidential-computing)
- [Firecracker](https://firecracker-microvm.github.io/)
- [gVisor](https://gvisor.dev/)
