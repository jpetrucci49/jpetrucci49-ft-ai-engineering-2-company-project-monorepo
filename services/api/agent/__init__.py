"""HealthCore desk agent graph — compiled LangGraph over 07.5 retrieve/generate.

The graph is loaded on attribute access. Importing ``agent.harness`` must not
import ``data.pipelines.rag`` while that module is still loading.
"""

__all__ = ["desk_graph", "run_desk_agent"]


def __getattr__(name: str):
    if name in __all__:
        from agent.graph import desk_graph, run_desk_agent

        return {"desk_graph": desk_graph, "run_desk_agent": run_desk_agent}[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
