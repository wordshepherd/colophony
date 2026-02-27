from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.add_issue_item_body import AddIssueItemBody
from ...models.add_issue_item_response_201 import AddIssueItemResponse201
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: AddIssueItemBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/issues/{id}/items".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AddIssueItemResponse201 | None:
    if response.status_code == 201:
        response_201 = AddIssueItemResponse201.from_dict(response.json())



        return response_201

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AddIssueItemResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddIssueItemBody,

) -> Response[AddIssueItemResponse201]:
    """ Add item to issue

     Add a pipeline item to an issue.

    Args:
        id (UUID): Resource UUID
        body (AddIssueItemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddIssueItemResponse201]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddIssueItemBody,

) -> AddIssueItemResponse201 | None:
    """ Add item to issue

     Add a pipeline item to an issue.

    Args:
        id (UUID): Resource UUID
        body (AddIssueItemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddIssueItemResponse201
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddIssueItemBody,

) -> Response[AddIssueItemResponse201]:
    """ Add item to issue

     Add a pipeline item to an issue.

    Args:
        id (UUID): Resource UUID
        body (AddIssueItemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddIssueItemResponse201]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddIssueItemBody,

) -> AddIssueItemResponse201 | None:
    """ Add item to issue

     Add a pipeline item to an issue.

    Args:
        id (UUID): Resource UUID
        body (AddIssueItemBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddIssueItemResponse201
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
