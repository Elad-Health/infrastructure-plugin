# SQL Server Wait Types Reference

Quick reference for interpreting SQL Server wait statistics.

## Critical Wait Types

### I/O Related

| Wait Type | Meaning | Common Causes | Resolution |
|-----------|---------|---------------|------------|
| `PAGEIOLATCH_SH` | Waiting to read page from disk | Slow disk, memory pressure | Add memory, faster storage |
| `PAGEIOLATCH_EX` | Waiting to write page to disk | Slow disk, checkpoint | Faster storage, optimize queries |
| `WRITELOG` | Waiting for transaction log write | Slow log disk, frequent commits | Faster log storage, batch commits |
| `IO_COMPLETION` | Waiting for I/O operation | Disk bottleneck | Faster storage |
| `ASYNC_IO_COMPLETION` | Async I/O completion | Backup/restore, bulk operations | Usually normal during backups |

### Locking Related

| Wait Type | Meaning | Common Causes | Resolution |
|-----------|---------|---------------|------------|
| `LCK_M_X` | Waiting for exclusive lock | Blocking, long transactions | Kill blocker, optimize transactions |
| `LCK_M_S` | Waiting for shared lock | Blocking | Optimize queries, add indexes |
| `LCK_M_U` | Waiting for update lock | Update blocking | Shorter transactions |
| `LCK_M_IX` | Waiting for intent exclusive | Table-level blocking | Index optimization |
| `LCK_M_IS` | Waiting for intent shared | Read blocking | Usually indicates serious blocking |

### Memory Related

| Wait Type | Meaning | Common Causes | Resolution |
|-----------|---------|---------------|------------|
| `RESOURCE_SEMAPHORE` | Waiting for query memory | Large queries, memory pressure | Optimize queries, add memory |
| `RESOURCE_SEMAPHORE_QUERY_COMPILE` | Waiting to compile query | Complex queries, CPU pressure | Simplify queries |
| `CMEMTHREAD` | Memory allocation contention | High concurrency | Usually self-resolving |

### CPU/Parallelism Related

| Wait Type | Meaning | Common Causes | Resolution |
|-----------|---------|---------------|------------|
| `CXPACKET` | Parallel query coordination | Parallelism | Often normal, check MAXDOP |
| `CXCONSUMER` | Parallel query consumer | Parallelism | Often normal |
| `SOS_SCHEDULER_YIELD` | CPU scheduling | High CPU usage | Optimize queries, add CPU |
| `THREADPOOL` | No available worker threads | Too many concurrent queries | Increase max worker threads |

### Network Related

| Wait Type | Meaning | Common Causes | Resolution |
|-----------|---------|---------------|------------|
| `ASYNC_NETWORK_IO` | Waiting for client | Slow client, large result sets | Optimize result size, faster network |
| `OLEDB` | OLEDB provider wait | Linked server calls | Optimize linked server queries |

### Buffer/Memory Related

| Wait Type | Meaning | Common Causes | Resolution |
|-----------|---------|---------------|------------|
| `PAGELATCH_*` | In-memory page contention | Hot pages, tempdb | Optimize tempdb, add files |
| `LATCH_*` | Internal latch waits | Various | Depends on specific latch type |

## Wait Type Analysis Pattern

### Step 1: Get Current Waits
```sql
-- Top waits by total wait time
SELECT wait_type, wait_time_ms, waiting_tasks_count
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN ('CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', ...)
ORDER BY wait_time_ms DESC
```

### Step 2: Categorize
- **I/O waits dominant:** Storage bottleneck
- **Lock waits dominant:** Blocking/contention
- **Memory waits dominant:** Memory pressure
- **CPU waits dominant:** CPU bottleneck

### Step 3: Correlate with Queries
Match wait types to expensive queries to identify root cause.

## Benign Waits (Usually Safe to Ignore)

These waits are typically normal background activity:

- `BROKER_*` - Service Broker (if not using it)
- `CLR_*` - CLR operations
- `DISPATCHER_QUEUE_SEMAPHORE` - System dispatcher
- `HADR_*` - Always On (if not using it)
- `LAZYWRITER_SLEEP` - Lazy writer idle
- `LOGMGR_QUEUE` - Log manager idle
- `ONDEMAND_TASK_QUEUE` - On-demand tasks
- `REQUEST_FOR_DEADLOCK_SEARCH` - Deadlock detection
- `SLEEP_*` - Sleep waits
- `SQLTRACE_*` - SQL Trace (unless investigating)
- `WAITFOR` - WAITFOR command
- `XE_*` - Extended Events

## Quick Diagnosis Guide

```
High PAGEIOLATCH_* → Check disk performance, memory
High LCK_* → Check for blocking sessions
High WRITELOG → Check transaction log disk
High RESOURCE_SEMAPHORE → Memory-intensive queries
High CXPACKET → Review parallelism settings
High ASYNC_NETWORK_IO → Client/network issues
High THREADPOOL → Too many concurrent requests
```

## Integration with MCP Tools

When analyzing performance:
1. `mcp__mssql__get_wait_stats()` → Get current waits
2. Match dominant wait type to this reference
3. `mcp__mssql__get_expensive_queries()` → Find related queries
4. `mcp__mssql__get_blocking()` → Check for blocking (if LCK_* waits)
