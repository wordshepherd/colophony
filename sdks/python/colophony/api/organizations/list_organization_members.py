from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.list_organization_members_response_200 import ListOrganizationMembersResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    org_id: UUID,
    *,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["page"] = page

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/organizations/{org_id}/members".format(org_id=quote(str(org_id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ListOrganizationMembersResponse200 | None:
    if response.status_code == 200:
        response_200 = ListOrganizationMembersResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ListOrganizationMembersResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListOrganizationMembersResponse200]:
    """ List organization members

     Returns a paginated list of members for the specified organization.

    Args:
        org_id (UUID):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListOrganizationMembersResponse200]
     """


    kwargs = _get_kwargs(
        org_id=org_id,
page=page,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListOrganizationMembersResponse200 | None:
    """ List organization members

     Returns a paginated list of members for the specified organization.

    Args:
        org_id (UUID):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListOrganizationMembersResponse200
     """


    return sync_detailed(
        org_id=org_id,
client=client,
page=page,
limit=limit,

    ).parsed

async def asyncio_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> Response[ListOrganizationMembersResponse200]:
    """ List organization members

     Returns a paginated list of members for the specified organization.

    Args:
        org_id (UUID):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ListOrganizationMembersResponse200]
     """


    kwargs = _get_kwargs(
        org_id=org_id,
page=page,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    page: int | Unset = 1,
    limit: int | Unset = 20,

) -> ListOrganizationMembersResponse200 | None:
    """ List organization members

     Returns a paginated list of members for the specified organization.

    Args:
        org_id (UUID):
        page (int | Unset): Page number (1-based) Default: 1.
        limit (int | Unset): Items per page (1-100, default 20) Default: 20.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ListOrganizationMembersResponse200
     """


    return (await asyncio_detailed(
        org_id=org_id,
client=client,
page=page,
limit=limit,

    )).parsed
