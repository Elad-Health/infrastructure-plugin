# Infrastructure Architecture

## Overview

This document describes the infrastructure architecture for the AIOps investigation system.

## CHAMDB SQL Server Architecture

### Single Host, Multiple Named Instances

**Host:** chamdb.eladsolutions.local

**Architecture:**
- Single physical/virtual SQL Server host
- 30-40+ named SQL Server instances on this host
- Each instance serves a different application/environment
- Named instance convention: `{APPLICATION}_{ENVIRONMENT}_DB`

### Instance Naming Convention

**Pattern:** `{APPLICATION}_{ENVIRONMENT}_DB`

**Examples:**
- V85X_PROD_DB - Version 85X Production
- V87X_PROD_DB - Version 87X Production
- V85X_PROD2_DB - Version 85X Production (secondary)
- V87X_QA_DB - Version 87X QA/Test
- V91X_DEV_DB - Version 91X Development

### Connection Strings

**Named Instance Format:**
```
Server: chamdb.eladsolutions.local\V85X_PROD_DB
Port: Dynamic (SQL Browser assigns)
```

**Default Instance:**
```
Server: chamdb.eladsolutions.local
Port: 1433
```

### Resource Sharing

**Shared Resources:**
- Physical CPU cores
- Physical memory
- Disk I/O bandwidth
- Network bandwidth

**Isolation:**
- Memory max settings per instance
- CPU affinity (if configured)
- Separate databases per instance

**Implications:**
- One instance can affect others (noisy neighbor)
- Resource exhaustion on one instance impacts all
- Disk space is often shared (same drives)

## Prometheus Monitoring Architecture

### Windows Exporter

**Purpose:** Monitors Windows application servers

**Installation:**
- Runs on each application server
- Exports metrics on port 9182
- Scraped by Prometheus server

**Job Name:** `windows_exporter`

**Instance Format:** `{hostname}:9182`

**Metrics Exported:**
- CPU usage (per core and total)
- Memory usage (committed, available)
- Disk usage (space, I/O)
- Network traffic (bytes in/out)
- Process counts
- Service status

### Application Server Architecture

**Server Naming:** Same base name as SQL instance (without _DB)

**Examples:**
- Application server: V85X_PROD
- SQL instance: V85X_PROD_DB (on CHAMDB)

**Application Stack:**
- Windows Server
- IIS (web server)
- .NET applications
- Connects to corresponding SQL instance on CHAMDB

### Prometheus Targets

**Target Discovery:**
- Static configuration (prometheus.yml)
- Lists all application servers to monitor
- Includes job name and port

**Health Monitoring:**
- Target health: up/down
- Scrape duration
- Last scrape time

## Azure DevOps / TFS Architecture

### Project Structure

**Project per Application:**
- V85X_PROD project
- V87X_QA project
- V91X_DEV project

**Repositories:**
- Each project may have multiple repositories
- Naming matches project name

### Build/Release Pipelines

**Build Pipeline:**
- Triggered by commit
- Compiles code
- Runs tests
- Produces artifacts

**Release Pipeline:**
- Triggered by successful build
- Deploys to target environment
- May deploy to multiple servers

### Environment Mapping

**Project → Environment → Target Servers:**
- V85X_PROD project → Production → V85X_PROD server → V85X_PROD_DB instance
- V87X_QA project → QA → V87X_QA server → V87X_QA_DB instance

## System Integration

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│         Azure DevOps / TFS (Source)             │
│  Builds, Releases, Code Changes                 │
└─────────────────────────────────────────────────┘
                      ↓ (deploys to)
┌─────────────────────────────────────────────────┐
│      Application Servers (Application Layer)    │
│  IIS, .NET Apps, Windows Server                 │
│  Monitored by: Prometheus (windows_exporter)    │
│  Examples: V85X_PROD, V87X_QA, V91X_DEV         │
└─────────────────────────────────────────────────┘
                      ↓ (connects to)
┌─────────────────────────────────────────────────┐
│   CHAMDB (Data Layer - Single SQL Server Host)  │
│  30+ Named SQL Server Instances                 │
│  Examples: V85X_PROD_DB, V87X_QA_DB, V91X_DEV_DB│
└─────────────────────────────────────────────────┘
```

### Data Flow

**Normal Operation:**
1. Application receives request
2. Application queries SQL Server instance
3. SQL Server returns data
4. Application returns response
5. Prometheus scrapes metrics every 15 seconds

**Deployment Flow:**
1. Code committed to Azure DevOps
2. Build pipeline triggered
3. Artifacts produced
4. Release pipeline deploys to application server
5. Application server updated (IIS restart)
6. New code now serving requests

**Incident Flow:**
1. Issue occurs (deployment, resource exhaustion, etc.)
2. Prometheus detects metric anomaly or alert fires
3. SQL Server shows symptoms (blocking, expensive queries)
4. Correlation reveals deployment timing or other cause

## Storage Architecture

### CHAMDB Storage Layout

**Common Pattern (but VERIFY from data):**
- C: drive - OS, SQL Server binaries, system databases
- D: drive - User database data files (.mdf)
- L: drive - Transaction log files (.ldf)
- T: drive - tempdb data and log files

**Per-Instance Subdirectories:**
```
D:\V85X_PROD_DB\Data\
D:\V85X_PROD_DB\Logs\
D:\V87X_QA_DB\Data\
D:\V87X_QA_DB\Logs\
```

**CRITICAL:** Always verify actual paths from `get_disk_space()` results. Do not assume.

### Disk Space Sharing

**Multiple Instances Share Drives:**
- All instances on D: share D: drive space
- One instance filling disk affects all instances
- Disk full on D: impacts ALL instances with databases on D:

**Monitoring Strategy:**
- Monitor total drive space (shared resource)
- Monitor individual database sizes (identify culprit)

## Network Architecture

**Typical Network Segments:**
- Application servers in DMZ or application VLAN
- CHAMDB in database VLAN
- Prometheus in monitoring VLAN
- Azure DevOps/TFS in management VLAN

**Connectivity Requirements:**
- Application servers → CHAMDB (SQL Server port)
- Prometheus → Application servers (port 9182)
- Azure DevOps → Application servers (deployment)

## High Availability / Disaster Recovery

**Current Architecture:**
- Single CHAMDB host (30+ instances)
- SPOF: If CHAMDB down, all instances unavailable
- Application servers are independent (one can fail without affecting others)

**Backup Strategy:**
- SQL Server backups (per instance)
- Typically to network share or backup server

## Capacity Considerations

**CHAMDB Resource Limits:**
- Physical CPU cores (shared by all instances)
- Physical memory (shared, with instance max settings)
- Disk I/O bandwidth (shared)
- Network bandwidth (shared)

**Scaling Challenges:**
- Cannot scale instances independently (shared host)
- Adding instance increases load on shared resources
- Eventually hits capacity ceiling
