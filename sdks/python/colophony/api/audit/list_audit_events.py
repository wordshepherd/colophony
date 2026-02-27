from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_audit_events_action import ListAuditEventsAction
from ...models.list_audit_events_resource import ListAuditEventsResource
from ...models.list_audit_events_response_200 import ListAuditEventsResponse200
from ...types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    action: ListAuditEventsAction | Unset = UNSET,
    resource: ListAuditEventsResource | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    resource_id: UUID | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_action: str | Unset = UNSET
    if not isinstance(action, Unset):
        json_action = action.value

    params["action"] = json_action

    json_resource: str | Unset = UNSET
    if not isinstance(resource, Unset):
        json_resource = resource.value

    params["resource"] = json_resource

    json_actor_id: str | Unset = UNSET
    if not isinstance(actor_id, Unset):
        json_actor_id = str(actor_id)
    params["actorId"] = json_actor_id

    json_resource_id: str | Unset = UNSET
    if not isinstance(resource_id, Unset):
        json_resource_id = str(resource_id)
    params["resourceId"] = json_resource_id

    json_from_: str | Unset = UNSET
    if not isinstance(from_, Unset):
        json_from_ = from_.isoformat()
    params["from"] = json_from_

    json_to: str | Unset = UNSET
    if not isinstance(to, Unset):
        json_to = to.isoformat()
    params["to"] = json_to

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/audit-events",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListAuditEventsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListAuditEventsResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListAuditEventsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    action: ListAuditEventsAction | Unset = UNSET,
    resource: ListAuditEventsResource | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    resource_id: UUID | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListAuditEventsResponse200]:
    """ List audit events

     Returns a paginated, filterable list of audit events for the current organization. Requires ADMIN
    role.

    Args:
        action (ListAuditEventsAction | Unset): Filter by audit action (e.g. ORG_CREATED)
        resource (ListAuditEventsResource | Unset): Filter by resource type (e.g. organization)
        actor_id (UUID | Unset): Filter by the user who performed the action
        resource_id (UUID | Unset): Filter by the affected resource ID
        from_ (datetime.datetime | Unset): Start of date range (ISO-8601)
        to (datetime.datetime | Unset): End of date range (ISO-8601)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListAuditEventsResponse200]
     """


    kwargs = _get_kwargs(
        action=action,
resource=resource,
actor_id=actor_id,
resource_id=resource_id,
from_=from_,
to=to,
page=page,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    action: ListAuditEventsAction | Unset = UNSET,
    resource: ListAuditEventsResource | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    resource_id: UUID | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListAuditEventsResponse200 | None:
    """ List audit events

     Returns a paginated, filterable list of audit events for the current organization. Requires ADMIN
    role.

    Args:
        action (ListAuditEventsAction | Unset): Filter by audit action (e.g. ORG_CREATED)
        resource (ListAuditEventsResource | Unset): Filter by resource type (e.g. organization)
        actor_id (UUID | Unset): Filter by the user who performed the action
        resource_id (UUID | Unset): Filter by the affected resource ID
        from_ (datetime.datetime | Unset): Start of date range (ISO-8601)
        to (datetime.datetime | Unset): End of date range (ISO-8601)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListAuditEventsResponse200
     """


    return sync_detailed(
        client=client,
action=action,
resource=resource,
actor_id=actor_id,
resource_id=resource_id,
from_=from_,
to=to,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    action: ListAuditEventsAction | Unset = UNSET,
    resource: ListAuditEventsResource | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    resource_id: UUID | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListAuditEventsResponse200]:
    """ List audit events

     Returns a paginated, filterable list of audit events for the current organization. Requires ADMIN
    role.

    Args:
        action (ListAuditEventsAction | Unset): Filter by audit action (e.g. ORG_CREATED)
        resource (ListAuditEventsResource | Unset): Filter by resource type (e.g. organization)
        actor_id (UUID | Unset): Filter by the user who performed the action
        resource_id (UUID | Unset): Filter by the affected resource ID
        from_ (datetime.datetime | Unset): Start of date range (ISO-8601)
        to (datetime.datetime | Unset): End of date range (ISO-8601)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListAuditEventsResponse200]
     """


    kwargs = _get_kwargs(
        action=action,
resource=resource,
actor_id=actor_id,
resource_id=resource_id,
from_=from_,
to=to,
page=page,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    action: ListAuditEventsAction | Unset = UNSET,
    resource: ListAuditEventsResource | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    resource_id: UUID | Unset = UNSET,
    from_: datetime.datetime | Unset = UNSET,
    to: datetime.datetime | Unset = UNSET,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListAuditEventsResponse200 | None:
    """ List audit events

     Returns a paginated, filterable list of audit events for the current organization. Requires ADMIN
    role.

    Args:
        action (ListAuditEventsAction | Unset): Filter by audit action (e.g. ORG_CREATED)
        resource (ListAuditEventsResource | Unset): Filter by resource type (e.g. organization)
        actor_id (UUID | Unset): Filter by the user who performed the action
        resource_id (UUID | Unset): Filter by the affected resource ID
        from_ (datetime.datetime | Unset): Start of date range (ISO-8601)
        to (datetime.datetime | Unset): End of date range (ISO-8601)
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListAuditEventsResponse200
     """


    return (await asyncio_detailed(
        client=client,
action=action,
resource=resource,
actor_id=actor_id,
resource_id=resource_id,
from_=from_,
to=to,
page=page,
limit=limit,

    )).parsed
