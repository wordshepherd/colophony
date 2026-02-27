from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.remove_organization_member_body import RemoveOrganizationMemberBody
from ...models.remove_organization_member_response_200 import RemoveOrganizationMemberResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    org_id: UUID,
    member_id: UUID,
    *,
    body: RemoveOrganizationMemberBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/organizations/{org_id}/members/{member_id}".format(org_id=quote(str(org_id), safe=""),member_id=quote(str(member_id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> RemoveOrganizationMemberResponse200 | None:
    if response.status_code == 200:
        response_200 = RemoveOrganizationMemberResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[RemoveOrganizationMemberResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    org_id: UUID,
    member_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RemoveOrganizationMemberBody | Unset = UNSET,

) -> Response[RemoveOrganizationMemberResponse200]:
    """ Remove a member

     Remove a member from the organization. Requires ADMIN role.

    Args:
        org_id (UUID):
        member_id (UUID):
        body (RemoveOrganizationMemberBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RemoveOrganizationMemberResponse200]
     """


    kwargs = _get_kwargs(
        org_id=org_id,
member_id=member_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    org_id: UUID,
    member_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RemoveOrganizationMemberBody | Unset = UNSET,

) -> RemoveOrganizationMemberResponse200 | None:
    """ Remove a member

     Remove a member from the organization. Requires ADMIN role.

    Args:
        org_id (UUID):
        member_id (UUID):
        body (RemoveOrganizationMemberBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RemoveOrganizationMemberResponse200
     """


    return sync_detailed(
        org_id=org_id,
member_id=member_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    org_id: UUID,
    member_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RemoveOrganizationMemberBody | Unset = UNSET,

) -> Response[RemoveOrganizationMemberResponse200]:
    """ Remove a member

     Remove a member from the organization. Requires ADMIN role.

    Args:
        org_id (UUID):
        member_id (UUID):
        body (RemoveOrganizationMemberBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[RemoveOrganizationMemberResponse200]
     """


    kwargs = _get_kwargs(
        org_id=org_id,
member_id=member_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    org_id: UUID,
    member_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RemoveOrganizationMemberBody | Unset = UNSET,

) -> RemoveOrganizationMemberResponse200 | None:
    """ Remove a member

     Remove a member from the organization. Requires ADMIN role.

    Args:
        org_id (UUID):
        member_id (UUID):
        body (RemoveOrganizationMemberBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        RemoveOrganizationMemberResponse200
     """


    return (await asyncio_detailed(
        org_id=org_id,
member_id=member_id,
client=client,
body=body,

    )).parsed
