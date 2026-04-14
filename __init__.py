"""
External LoRA Loader — ComfyUI custom node entry point.

Registers the ExternalLoraLoader node and its API routes with ComfyUI.
WEB_DIRECTORY points ComfyUI to serve web/ext.js as a frontend extension.
"""

WEB_DIRECTORY = "./web"

from .nodes import ExternalLoraLoader

from server import PromptServer
from .api import register_routes
register_routes(PromptServer.instance.routes)

NODE_CLASS_MAPPINGS = {
    "ExternalLoraLoader": ExternalLoraLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ExternalLoraLoader": "External LoRA Loader",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
