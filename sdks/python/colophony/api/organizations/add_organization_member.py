from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.add_organization_member_body import AddOrganizationMemberBody
from ...models.add_organization_member_response_201 import AddOrganizationMemberResponse201
from typing import cast
from uuid import UUID



def _get_kwargs(
    org_id: UUID,
    *,
    body: AddOrganizationMemberBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/organizations/{org_id}/members".format(org_id=quote(str(org_id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AddOrganizationMemberResponse201 | None:
    if response.status_code == 201:
        response_201 = AddOrganizationMemberResponse201.from_dict(response.json())



        return response_201

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AddOrganizationMemberResponse201]:
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
    body: AddOrganizationMemberBody,

) -> Response[AddOrganizationMemberResponse201]:
    """ Add a member

     Invite a user to the organization by email. The user must already have an account. Requires ADMIN
    role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddOrganizationMemberResponse201]
     """


    kwargs = _get_kwargs(
        org_id=org_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddOrganizationMemberBody,

) -> AddOrganizationMemberResponse201 | None:
    """ Add a member

     Invite a user to the organization by email. The user must already have an account. Requires ADMIN
    role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddOrganizationMemberResponse201
     """


    return sync_detailed(
        org_id=org_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddOrganizationMemberBody,

) -> Response[AddOrganizationMemberResponse201]:
    """ Add a member

     Invite a user to the organization by email. The user must already have an account. Requires ADMIN
    role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddOrganizationMemberResponse201]
     """


    kwargs = _get_kwargs(
        org_id=org_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddOrganizationMemberBody,

) -> AddOrganizationMemberResponse201 | None:
    """ Add a member

     Invite a user to the organization by email. The user must already have an account. Requires ADMIN
    role.

    Args:
        org_id (UUID):
        body (AddOrganizationMemberBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddOrganizationMemberResponse201
     """


    return (await asyncio_detailed(
        org_id=org_id,
client=client,
body=body,

    )).parsed
